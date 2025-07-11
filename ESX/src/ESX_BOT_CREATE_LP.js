/********* IMPORTS *********/
const { ethers } = require("ethers");
require("dotenv").config();
const fetch = require("node-fetch");
const fs = require("node:fs");
const JSBI = require("jsbi");
const { BigNumber } = require("ethers");
const { getNonce } = require("./helpers");

const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const ERC20ABI = require("./abi.json");
const { Token, Percent } = require("@uniswap/sdk-core");
const { Pool, Position, nearestUsableTick } = require("@uniswap/v3-sdk");
const { NonfungiblePositionManager } = require("@uniswap/v3-sdk");

/********* CONFIG *********/
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const WALLET_ADDRESS = process.env.MY_WALLET;
const WALLET_SECRET = process.env.MY_PK_DEV_WALLET;

const provider = new ethers.providers.JsonRpcProvider(
  `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
);
const wallet = new ethers.Wallet(WALLET_SECRET, provider);
const connectedWallet = wallet.connect(provider);

/********* CONSTANTS *********/
const minPriceFactor = 0.9;
const maxPriceFactor = 1.1;
const factorInLP = 0.7;
const setGasLimit = 1_000_000;
const setGasHigher = 1;
const fee = 3000;
const chainId = 8453;

const baseTokenCA = "0x4200000000000000000000000000000000000006"; // WETH
const quoteTokenCA = "0x6a72d3a87f97a0fee2c2ee4233bdaebc32813d7a"; // ESX
const poolAddress = "0xc787ff6f332ee11b2c24fd8c112ac155f95b14ab";
const positionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";

// Token decimals (used for scaling values)
const decimalsBase = 10 ** 18; // WETH decimals
const decimalsQuote = 10 ** 9; // ESX decimals
const name0 = "Wrapped Ether",
  symbol0 = "WETH",
  decimals0 = 18,
  address0 = baseTokenCA;
const name1 = "ESX",
  symbol1 = "ESX",
  decimals1 = 9,
  address1 = quoteTokenCA;

const BaseToken = new Token(chainId, address0, decimals0, symbol0, name0);
const QuoteToken = new Token(chainId, address1, decimals1, symbol1, name1);

/********* STATE VARIABLES *********/
let currentPrice = 0;
let sqrtPriceX96 = 0;
let ethPrice = 0;
let currentPriceETH_ESX = 0;

/********* CONTRACT INSTANCES *********/
const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
);
const contractBaseToken = new ethers.Contract(
  baseTokenCA,
  ERC20ABI,
  connectedWallet
);

const contractQuoteToken = new ethers.Contract(
  quoteTokenCA,
  ERC20ABI,
  connectedWallet
);

/********* STEP 1: APPROVE TOKENS *********/
async function approveContract(tokenContract, nonce) {
  const feeData = await provider.getFeeData();
  const amountIn = 1e36;
  const approvalAmount = JSBI.BigInt(amountIn).toString();

  const tx = await tokenContract.approve(
    positionManagerAddress,
    approvalAmount,
    {
      maxFeePerGas: feeData.maxFeePerGas.mul(setGasHigher),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(setGasHigher),
      gasLimit: setGasLimit,
      nonce,
    }
  );

  console.log("  → TX sent:", tx.hash);
  const receipt = await tx.wait(1);
  console.log("  ✅ Confirmed in block:", receipt.blockNumber);
}

// Function to calculate price ESX/WETH using sqrtPriceX96
function getPriceFromSqrtPriceX96(sqrtPriceX96, decimals0, decimals1) {
  const Q96 = BigNumber.from(2).pow(96);

  // Step 1: Convert to floating-point sqrtRatio
  const sqrtRatio =
    parseFloat(sqrtPriceX96.toString()) / parseFloat(Q96.toString());

  // Step 2: Square it to get token1/token0 price
  const priceToken1PerToken0 = sqrtRatio * sqrtRatio;

  // Step 3: Adjust for decimals if needed
  currentPriceETH_ESX = priceToken1PerToken0 * 10 ** (decimals0 - decimals1);

  console.log("ESX/WETH price:", currentPriceETH_ESX); // This is price of 1 ESX in WETH
}

/********* STEP 2: FETCH POOL DATA *********/
async function getPoolData(poolContract) {
  let [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  let tickPrice = slot0[1];
  sqrtPriceX96 = slot0[0];

  console.log("tick:", tickPrice);
  console.log("sqrtPriceX96: ", sqrtPriceX96.toString());

  // Always prefer sqrtPriceX96 for price calculation
  // More precise than price based on the tick
  getPriceFromSqrtPriceX96(sqrtPriceX96, decimals0, decimals1);

  //console.log("tick:", tickPrice);
  return {
    tickSpacing,
    fee,
    liquidity,
    sqrtPriceX96,
    tick: tickPrice,
    currentPrice,
  };
}

/********* STEP 3: READ BALANCES *********/
async function readBalance() {
  // Get ETH balance in wei
  const balanceETH = await provider.getBalance(WALLET_ADDRESS);

  // Get token balances in wei
  const balanceInWeiESX = await contractQuoteToken.balanceOf(WALLET_ADDRESS);
  const balanceInWeiWETH = await contractBaseToken.balanceOf(WALLET_ADDRESS);

  // ✅ Convert from string to float properly before arithmetic
  const balanceESX =
    parseFloat(ethers.utils.formatEther(balanceInWeiESX)) *
    (decimalsBase / decimalsQuote);
  const balanceWETH = parseFloat(ethers.utils.formatEther(balanceInWeiWETH));
  const ethBalanceFloat = parseFloat(ethers.utils.formatEther(balanceETH));

  // Get current pool state and ETH price in USD
  await getPoolData(poolContract);
  await getETHPrice();
  const currentPriceETH = ethPrice;

  console.log("ETH Price (USD):", currentPriceETH);
  console.log("ESX per ETH:", currentPriceETH_ESX);

  // USD values for each token
  const usdETH = ethBalanceFloat * currentPriceETH;
  const usdESX = (balanceESX * currentPriceETH_ESX) / currentPriceETH;
  const usdWETH = balanceWETH * currentPriceETH;
  const total = (usdETH + usdESX + usdWETH).toFixed(2);

  // Compute required token amounts based on sqrt price range
  const sqrtP = Math.sqrt(currentPriceETH_ESX);
  const sqrtPmin = sqrtP * minPriceFactor;
  const sqrtPmax = sqrtP * maxPriceFactor;
  const L = 1;
  const requiredETH = (L * (sqrtPmax - sqrtP)) / (sqrtP * sqrtPmax);
  const requiredESX = L * (sqrtP - sqrtPmin);

  console.log(
    `ETH needed: ${requiredETH} (~${requiredETH * currentPriceETH} USD)`
  );
  console.log(
    `ESX needed: ${requiredESX} (~${
      (requiredESX * currentPriceETH) / currentPriceETH_ESX
    } USD)`
  );

  console.log("currentPriceETH_ESX: ", currentPriceETH_ESX);

  console.log("📦 Final balances + needs:", {
    balanceESX,
    balanceWETH,
    requiredETH,
    requiredESX,
  });

  return {
    balanceESX,
    balanceETH: balanceWETH,
    requiredESX,
    requiredETH,
  };
}

/********* FETCH ETH PRICE *********/
async function getETHPrice() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
  );
  const data = await res.json();
  //console.log("Coingecko response:", data);
  ethPrice = data.ethereum.usd;
  console.log(`ETH/USD (from Coingecko): $${ethPrice}`);
}

async function addLiquidity(nonce) {
  // === 1. Fetch wallet balances ===
  const [balanceETH, balanceQuoteRaw, balanceBaseRaw] = await Promise.all([
    provider.getBalance(wallet.address),
    contractQuoteToken.balanceOf(wallet.address),
    contractBaseToken.balanceOf(wallet.address),
  ]);
  const balanceBase = parseFloat(ethers.utils.formatEther(balanceBaseRaw));
  const balanceQuote = parseFloat(
    ethers.utils.formatUnits(balanceQuoteRaw, decimals1)
  );

  console.log(
    "ETH:",
    balanceETH.toString() / 1e18,
    name0 + ":",
    balanceBase,
    name1 + ":",
    balanceQuote
  );

  // === 2. Get pool state ===
  const poolData = await getPoolData(poolContract);
  console.log(
    "tick:",
    poolData.tick,
    "sqrtPriceX96:",
    poolData.sqrtPriceX96.toString()
  );

  // === 3. Compute price range ticks ===

  // Calculate the lower and upper ticks for the price range
  tickForLowerPrice = parseInt(
    Math.log(
      (currentPriceETH_ESX * minPriceFactor * decimalsQuote) / decimalsBase
    ) / Math.log(1.0001)
  );
  tickForHigherPrice = parseInt(
    Math.log(
      (currentPriceETH_ESX * maxPriceFactor * decimalsQuote) / decimalsBase
    ) / Math.log(1.0001)
  );

  // At high price ratios (like ESX/WETH = 147k), the tick curve is very steep.
  // So even ±10% around a high price translates to a narrow usable range in liquidity space —
  // most of your liquidity gets pushed into a tiny band around the current price.
  console.log("CurrentPrice: ", currentPriceETH_ESX);
  console.log("Lower tick: ", tickForLowerPrice);
  console.log("Higher tick: ", tickForHigherPrice);

  // Adjust ticks to the nearest usable values and extend the range slightly
  let tickLower =
    nearestUsableTick(tickForLowerPrice, poolData.tickSpacing) -
    poolData.tickSpacing * 2;
  let tickUpper =
    nearestUsableTick(tickForHigherPrice, poolData.tickSpacing) +
    poolData.tickSpacing * 2;

  // === 4. Build SDK Position ===
  // Check which token is token 0 and 1
  const poolSDK = new Pool(
    //BaseToken,
    QuoteToken,
    BaseToken,
    fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  );

  const amountToken0 = balanceBase * factorInLP;
  console.log("Amount Token 0: ", amountToken0);
  const amountToken0Str = amountToken0.toFixed(decimals0);
  const amount0 = ethers.utils.parseUnits(amountToken0Str, decimals0);

  const position = Position.fromAmount0({
    pool: poolSDK,
    tickLower,
    tickUpper,
    amount0: amount0.toString(),
    useFullPrecision: true,
  });

  // Calculate required amounts 0 and 1
  const requiredAmount0 = BigNumber.from(
    position.mintAmounts.amount0.toString()
  );
  const requiredAmount1 = BigNumber.from(
    position.mintAmounts.amount1.toString()
  );

  console.log(
    "Desired:",
    requiredAmount0.toString(),
    requiredAmount1.toString()
  );

  // Check if we have enough token 0 and 1 in wallet
  const [balance0Raw, balance1Raw] = await Promise.all([
    contractBaseToken.balanceOf(wallet.address),
    contractQuoteToken.balanceOf(wallet.address),
  ]);

  if (balance0Raw.lt(requiredAmount0) || balance1Raw.lt(requiredAmount1)) {
    console.error("❌ Insufficient balance to mint LP position.");
    console.log(`Need: ${requiredAmount0} token0, ${requiredAmount1} token1`);
    console.log(
      `Have: ${balance0Raw.toString()} token0, ${balance1Raw.toString()} token1`
    );
    return;
  }

  // === 6. Build and send mint transaction ===
  const { calldata, value } = NonfungiblePositionManager.addCallParameters(
    position,
    {
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 600,
      slippageTolerance: new Percent(50, 10000),
    }
  );

  const feeData = await provider.getFeeData();
  try {
    const tx2 = await wallet.sendTransaction({
      to: positionManagerAddress,
      data: calldata,
      value,
      maxFeePerGas: feeData.maxFeePerGas.mul(setGasHigher),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(setGasHigher),
      gasLimit: setGasLimit,
      nonce: nonce,
    });

    console.log("Mint tx sent:", tx2.hash);
    const receipt2 = await tx2.wait(1);
    console.log("✅ LP Minted in block:", receipt2.blockNumber);
  } catch (err) {
    console.error("❌ Mint transaction failed:", err.reason || err.message);
  }
}

async function createLP() {
  await getETHPrice();
  await readBalance();

  // Approve both tokens: only need to approve once
  // Use unique nonces for each tx
  //const nonce1 = await getNonce(); // for base token approval
  //await approveContract(contractBaseToken, nonce1);

  //const nonce2 = await getNonce(); // for quote token approval
  //await approveContract(contractQuoteToken, nonce2);

  const nonce3 = await getNonce(); // for LP mint
  // Mint LP position with next nonce
  await addLiquidity(nonce3);
}

module.exports = createLP;

if (require.main === module) {
  createLP().catch(console.error);
}
