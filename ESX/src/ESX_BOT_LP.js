/********* IMPORTS *********/
const { ethers } = require("ethers");
const { JsonRpcProvider } = require("ethers");
require("dotenv").config();
const fetch = require("node-fetch");
const fs = require("node:fs");
const JSBI = require("jsbi");
const { BigNumber } = require("ethers");

const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const {
  abi: SwapRouterABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json");
const {
  abi: INonfungiblePositionManagerABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json");
const aggregatorV3InterfaceABI = require("./abis/pricefeedABI.json");
const ERC20ABI = require("./abi.json");
const { Token, Percent } = require("@uniswap/sdk-core");
const { Pool, Position, nearestUsableTick } = require("@uniswap/v3-sdk");
const { TickMath, FullMath, TickList } = require("@uniswap/v3-sdk");
const { MintOptions, NonfungiblePositionManager } = require("@uniswap/v3-sdk");
const { getPoolImmutables, getPoolState } = require("./helpers");

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
const factorInLP = 0.5;
const setGasLimit = 3000000;
const setGasHigher = 1;
const fee = 3000;
const chainId = 8453;

const baseTokenCA = "0x4200000000000000000000000000000000000006"; // WETH
const quoteTokenCA = "0x6a72d3a87f97a0fee2c2ee4233bdaebc32813d7a"; // ESX
const poolAddress = "0xc787ff6f332ee11b2c24fd8c112ac155f95b14ab";
const swapRouterAddress = "0x2626664c2603336E57B271c5C0b26F421741e481";
//0xE592427A0AEce92De3Edee1F18E0157C05861564
const positionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const oracleAddress = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";

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
let minPrice = 0;
let maxPrice = 0;
let sqrtPriceX96 = 0;
let ethPrice = 0;
let scenario = 0;
let statusPoolContract = 1;
let priceOracleETHUSDC = 0;
let nonceNumber = 0;
let currentPriceETH_ESX = 0;

/********* CONTRACT INSTANCES *********/
// const tokenContract0 = new ethers.Contract(address0, ERC20ABI, provider);
// const tokenContract1 = new ethers.Contract(address1, ERC20ABI, provider);
const swapRouterContract = new ethers.Contract(
  swapRouterAddress,
  SwapRouterABI,
  provider
);
const NonfungiblePositionContract = new ethers.Contract(
  positionManagerAddress,
  IUniswapV3PoolABI,
  provider
);
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
/********* NONCE TRACKING *********/
let baseNonce = provider.getTransactionCount(WALLET_ADDRESS);
let nonceOffset = 0;
function getNonce() {
  return baseNonce.then((nonce) => nonce + nonceOffset++);
}

/********* STEP 1: APPROVE TOKENS *********/
async function approveContract(tokenContract) {
  let feeData = await provider.getFeeData();
  let amountIn = 1e36;
  const approvalAmount = JSBI.BigInt(amountIn).toString();

  // await tokenContract
  //   .connect(connectedWallet)
  //   .approve(swapRouterAddress, approvalAmount, {
  //     maxFeePerGas: feeData.maxFeePerGas * setGasHigher,
  //     maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher,
  //     gasLimit: setGasLimit,
  //     nonce: getNonce(),
  //   });

  await tokenContract
    .connect(connectedWallet)
    .approve(positionManagerAddress, approvalAmount, {
      maxFeePerGas: feeData.maxFeePerGas * setGasHigher,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher,
      gasLimit: setGasLimit,
      nonce: getNonce(),
    });
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

async function addLiquidity() {
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

  // const amountToken0 = balanceQuote * factorInLP;
  // console.log("Amount Token 0: ", amountToken0);
  // const amountToken0Str = amountToken0.toFixed(decimals1);
  // const amount0 = ethers.utils.parseUnits(amountToken0Str, decimals1);
  // console.log("Amount Token 0: ", amountToken0);

  const position = Position.fromAmount0({
    pool: poolSDK,
    tickLower,
    tickUpper,
    amount0: amount0.toString(),
    useFullPrecision: true,
  });

  console.log(
    "Desired:",
    position.mintAmounts.amount0.toString(),
    position.mintAmounts.amount1.toString()
  );

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
  const tx = await wallet.sendTransaction({
    to: positionManagerAddress,
    data: calldata,
    value,
    maxFeePerGas: feeData.maxFeePerGas.mul(setGasHigher),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.mul(setGasHigher),
    gasLimit: setGasLimit,
    nonce: await getNonce(),
  });
  console.log("Mint tx:", tx.hash);
  await tx.wait();
  console.log("✅ LP Minted");
}

async function main() {
  await getETHPrice();
  await readBalance();
  // await approveContract(contractBaseToken);
  //await approveContract(contractQuoteToken);
  await addLiquidity();
}
main();
