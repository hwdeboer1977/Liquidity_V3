const { ethers } = require("ethers");
require("dotenv").config();
const ERC20ABI = require("./abi.json");
const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");

// --- Wallet Setup ---
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const WALLET_ADDRESS = process.env.MY_WALLET;
const WALLET_SECRET = process.env.MY_PK_DEV_WALLET;

// Connect to Base Mainnet RPC (chainId 8453):contentReference[oaicite:3]{index=3}
const provider = new ethers.providers.JsonRpcProvider(
  `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
);
const wallet = new ethers.Wallet(WALLET_SECRET, provider);
const connectedWallet = wallet.connect(provider);

// Addresses (Base network)
const UNIVERSAL_ROUTER_ADDRESS = "0x6ff5693b99212da76ad316178a184ab56d299b43"; // UniversalRouter on Base:contentReference[oaicite:9]{index=9}
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Permit2 (global):contentReference[oaicite:10]{index=10}
const TOKEN_IN_ADDRESS = "0x6a72d3A87f97a0fEE2c2ee4233BdAEBc32813D7a"; // ESX
const TOKEN_OUT_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH
const WETH_DECIMALS = 18; // WETH decimals
const ESX_DECIMALS = 9;
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH
const ESX_ADDRESS = "0x6a72d3a87f97a0fee2c2ee4233bdaebc32813d7a"; // ESX
const poolAddress = "0xc787ff6f332ee11b2c24fd8c112ac155f95b14ab";
const decimalsBase = 10 ** 18; // WETH decimals
const decimalsQuote = 10 ** 9; // ESX decimals
const minPriceFactor = 0.9;
const maxPriceFactor = 1.1;
const factorInLP = 0.5;
let amountIn = 0;
let tokenInAddress = 0;
let tokenOutAddress = 0;
let tokenIn = 0;
let decimals = 0;
let decimalsOut = 0;

// ABI snippets for required functions
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];
const PERMIT2_ABI = [
  "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
];
const UNIVERSAL_ROUTER_ABI = [
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable returns (bytes[] memory)",
];

// Uniswap V3 Factory on Base (chain 8453)
const UNISWAP_V3_FACTORY_ADDRESS = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const UNISWAP_V3_FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address)",
];

const factory = new ethers.Contract(
  UNISWAP_V3_FACTORY_ADDRESS,
  UNISWAP_V3_FACTORY_ABI,
  provider
);

// Set up Quoter
const QUOTER_ADDRESS = "0x28aF629a9F3ECE3c8D9F0b7cCf6349708CeC8cFb";
const QUOTER_ABI = [
  "function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut)",
];
const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);

const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
);

const contractBaseToken = new ethers.Contract(
  WETH_ADDRESS,
  ERC20ABI,
  connectedWallet
);

const contractQuoteToken = new ethers.Contract(
  ESX_ADDRESS,
  ERC20ABI,
  connectedWallet
);

/********* NONCE TRACKING *********/
const baseNoncePromise = provider.getTransactionCount(
  WALLET_ADDRESS,
  "pending"
);
let nonceOffset = 0;
function getNonce() {
  return baseNoncePromise.then((n) => n + nonceOffset++);
}

// Contract instances
const tokenWETH = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, wallet);
const tokenESX = new ethers.Contract(ESX_ADDRESS, ERC20_ABI, wallet);
const permit2 = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);
const router = new ethers.Contract(
  UNIVERSAL_ROUTER_ADDRESS,
  UNIVERSAL_ROUTER_ABI,
  wallet
);

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
  currentPrice = (Math.pow(1.0001, tickPrice) * decimalsBase) / decimalsQuote;

  console.log("tick:", tickPrice);
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
  const currentPriceETH_ESX = currentPrice;
  const currentPriceETH = ethPrice;

  console.log("ETH Price (USD):", currentPriceETH);
  console.log("ESX per ETH:", currentPriceETH_ESX);

  // USD values for each token
  const usdETH = ethBalanceFloat * currentPriceETH;
  const usdESX = (balanceESX * currentPriceETH) / currentPriceETH_ESX;
  const usdWETH = balanceWETH * currentPriceETH;

  console.log("Amount WETH: ", balanceWETH);
  console.log("Amount ESX: ", balanceESX);
  console.log("USD value of WETH: ", usdWETH);
  console.log("USD value of ESX: ", usdESX);

  const totalUSD = usdWETH + usdESX;
  console.log("USD value of both: ", totalUSD);

  const targetUSD = totalUSD / 2;
  // Step 2: Determine deficit
  const diffESX = targetUSD - usdESX;
  const diffWETH = targetUSD - usdWETH;
  console.log("Difference ESX: ", diffESX);
  console.log("Difference WETH: ", diffWETH);

  if (diffESX > 0) {
    // You need more ESX → sell WETH
    const wethToSell = diffESX / ethPrice;
    console.log(`🔁 Swap ${wethToSell.toFixed(9)} WETH → ESX`);

    // ✅ Round to 18 decimals for WETH
    amountIn = ethers.utils.parseUnits(wethToSell.toFixed(18), 18);

    // Update token addresses
    tokenInAddress = WETH_ADDRESS;
    tokenOutAddress = ESX_ADDRESS;
    tokenIn = tokenWETH;
    decimals = WETH_DECIMALS;
    decimalsOut = ESX_DECIMALS;
  } else if (diffWETH > 0) {
    // You need more WETH → sell ESX
    const esxToSell = (diffWETH * currentPriceETH_ESX) / ethPrice;

    console.log(`🔁 Swap ${esxToSell.toFixed(9)} ESX → WETH`);

    // ✅ Round to 9 decimals for ESX
    amountIn = ethers.utils.parseUnits(esxToSell.toFixed(9), 9);

    tokenInAddress = ESX_ADDRESS;
    tokenOutAddress = WETH_ADDRESS;
    tokenIn = tokenESX;
    decimals = ESX_DECIMALS;
    decimalsOut = WETH_DECIMALS;
  } else {
    console.log("✅ LP token values are balanced. No swap needed.");
  }

  // // Compute required token amounts based on sqrt price range
  // const sqrtP = Math.sqrt(currentPriceETH_ESX);
  // const sqrtPmin = sqrtP * minPriceFactor;
  // const sqrtPmax = sqrtP * maxPriceFactor;
  // const L = 1;
  // const requiredETH = (L * (sqrtPmax - sqrtP)) / (sqrtP * sqrtPmax);
  // const requiredESX = L * (sqrtP - sqrtPmin);

  // console.log(
  //   `ETH needed: ${requiredETH} (~${requiredETH * currentPriceETH} USD)`
  // );
  // console.log(
  //   `ESX needed: ${requiredESX} (~${
  //     (requiredESX * currentPriceETH) / currentPriceETH_ESX
  //   } USD)`
  // );

  // console.log("📦 Final balances + needs:", {
  //   balanceESX,
  //   balanceWETH,
  //   requiredETH,
  //   requiredESX,
  // });

  // return {
  //   balanceESX,
  //   balanceETH: balanceWETH,
  //   requiredESX,
  //   requiredETH,
  // };
}

/********* FETCH ETH PRICE *********/
async function getETHPrice() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
  );
  const data = await res.json();
  ethPrice = data.ethereum.usd;
  console.log(`ETH/USD (from Coingecko): $${ethPrice}`);
}

async function swapTokens() {
  // Check nonce
  getNonce();
  console.log("Nonce: ", nonceOffset);

  await readBalance();

  // 1. ERC-20 approve: wallet -> Permit2
  console.log("Approving Permit2 to spend input tokens...");
  const tx = await tokenIn.approve(PERMIT2_ADDRESS, amountIn);
  console.log("Approve tx hash:", tx.hash);

  // Wait for 1 confirmation
  const receipt = await tx.wait(1);
  console.log("✅ Approval confirmed in block", receipt.blockNumber);
  console.log(
    "Permit2 approved for",
    ethers.utils.formatEther(amountIn),
    "tokens"
  );

  // 2. Permit2 approve: Permit2 → Router (allow router to spend from Permit2)
  const permitExpiry = Math.floor(Date.now() / 1000) + 3600; // valid for 1 hour

  console.log("Approving Router via Permit2...");
  const tx2 = await permit2.approve(
    tokenInAddress,
    UNIVERSAL_ROUTER_ADDRESS,
    amountIn,
    permitExpiry,
    { nonce: await getNonce() }
  );
  console.log("Permit2→Router approval tx hash:", tx2.hash);

  //👉 Wait for on-chain confirmation
  const receipt2 = await tx2.wait(1);
  console.log(
    "✅ Universal Router approval confirmed in block",
    receipt2.blockNumber
  );

  // Build the swap path: tokenIn -> tokenOut with fee
  const fee = 3000; // pool fee 0.30% (3000 in Uniswap V3 fee units)
  const path = ethers.utils.solidityPack(
    ["address", "uint24", "address"],
    [tokenInAddress, fee, tokenOutAddress]
  );

  const quoter = new ethers.Contract(QUOTER_ADDRESS, QUOTER_ABI, provider);

  // // use callStatic to simulate without signing a tx
  const quotedOut = await quoter.callStatic.quoteExactInput(path, amountIn);

  console.log("Quoted WETH:", ethers.utils.formatUnits(quotedOut, decimalsOut));

  // Define slippage tolerance and deadline
  const slippagePercent = 1; // e.g.  1% acceptable slippage
  const slippageTolerance = 100 - slippagePercent;
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minute deadline from now

  // Estimate expected output (for demonstration, assume ~50 USDC for 0.1 WETH)
  const amountOutMin = quotedOut.mul(slippageTolerance).div(100);
  console.log(
    "Minimum acceptable output:",
    ethers.utils.formatUnits(amountOutMin, decimalsOut)
  );

  console.log(
    `Swapping ${ethers.utils.formatUnits(
      amountIn,
      decimals
    )} ESX for ${ethers.utils.formatUnits(amountOutMin, 18)}`
  );

  // This yields 50 * 0.99 = 49.5 USDC as minimum, in scaled units

  // Using solidityPack for an unpadded byte path (V3 path is tightly packed as token+fee+token):contentReference[oaicite:23]{index=23}

  // Prepare commands and inputs for Universal Router
  const commands = "0x00"; // V3_SWAP_EXACT_IN command
  const swapInput = ethers.utils.defaultAbiCoder.encode(
    ["address", "uint256", "uint256", "bytes", "bool"],
    [wallet.address, amountIn, amountOutMin, path, true]
  );
  const inputs = [swapInput];

  const feeData = await provider.getFeeData();
  const base = feeData.lastBaseFeePerGas; // current base-fee
  const tip = feeData.maxPriorityFeePerGas; // recommended tip (~1.5 gwei)
  const bumpedTip = tip.mul(ethers.BigNumber.from(3)); // triple the tip
  const maxFee = base.mul(2).add(bumpedTip); // allow some buffer

  console.log("baseFee:", ethers.utils.formatUnits(base, "gwei"), "gwei");
  console.log(
    "tip:",
    ethers.utils.formatUnits(tip, "gwei"),
    "→ bumped to:",
    ethers.utils.formatUnits(bumpedTip, "gwei")
  );
  console.log("maxFee:", ethers.utils.formatUnits(maxFee, "gwei"));

  getNonce();
  console.log("Nonce: ", nonceOffset);

  const poolAddr = await factory.getPool(tokenInAddress, tokenOutAddress, fee);
  console.log("Pool:", poolAddr);

  const txSwap = await router.execute(commands, inputs, deadline, {
    maxPriorityFeePerGas: bumpedTip,
    maxFeePerGas: maxFee,
    gasLimit: ethers.BigNumber.from("5000000"), // enough limit for swap
  });
  const receiptSwap = await txSwap.wait();
  console.log("Swapped!", receiptSwap.transactionHash);
}

module.exports = swapTokens;

if (require.main === module) {
  swapTokens().catch(console.error);
}
