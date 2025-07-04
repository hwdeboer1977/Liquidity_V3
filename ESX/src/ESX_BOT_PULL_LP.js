/********* IMPORTS *********/
const { ethers } = require("ethers");
require("dotenv").config();
const { getNonce } = require("./helpers"); // import it
const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const JSBI = require("jsbi");
const ERC20ABI = require("./abi.json");

/********* CONFIG *********/
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const WALLET_ADDRESS = process.env.MY_WALLET;
const WALLET_SECRET = process.env.MY_PK_DEV_WALLET;
const poolAddress = "0xc787ff6f332ee11b2c24fd8c112ac155f95b14ab";

const provider = new ethers.providers.JsonRpcProvider(
  `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
);
const wallet = new ethers.Wallet(WALLET_SECRET, provider);

// Max value for uint128 (used to collect all tokens)
const MaxUint128 = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffff");

// Uniswap V3 Position Manager
const positionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";

// Manually defined ABI for minimal PositionManager interaction
const INonfungiblePositionManagerABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) external returns (uint256 amount0, uint256 amount1)",
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) external returns (uint256 amount0, uint256 amount1)",
  "function multicall(bytes[] calldata data) payable external returns (bytes[] memory results)",
];

// Contract instances
const positionManager = new ethers.Contract(
  positionManagerAddress,
  INonfungiblePositionManagerABI,
  wallet
);

const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
);

// Utility: convert sqrtPriceX96 to tick
function getTickAtSqrtRatio(sqrtPriceX96) {
  let tick = Math.floor(Math.log((sqrtPriceX96 / Q96) ** 2) / Math.log(1.0001));
  return tick;
}

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));

/********* REMOVE LIQUIDITY + COLLECT *********/
async function removeLiquidity(nonce) {
  const balance = await positionManager.balanceOf(WALLET_ADDRESS);
  if (balance.eq(0)) {
    console.log("No positions found.");
    return;
  }

  const positionId = await positionManager.tokenOfOwnerByIndex(
    WALLET_ADDRESS,
    balance.sub(1)
  );

  console.log("Most recent NFT Position ID:", positionId.toString());

  const pos = await positionManager.positions(positionId);
  const liquidity = pos.liquidity;
  console.log("Liquidity: ", liquidity.toString());

  // ⛔️ Guard clause for empty positions
  if (liquidity.isZero()) {
    console.log("⚠️ Position has zero liquidity. Skipping removal.");
    return;
  }

  const deadline = Math.floor(Date.now() / 1000) + 600;

  const iface = new ethers.utils.Interface(INonfungiblePositionManagerABI);

  // Token contracts
  var token0contract = new ethers.Contract(pos.token0, ERC20ABI, provider);
  var token1contract = new ethers.Contract(pos.token1, ERC20ABI, provider);

  // Get ticks to determine amounts
  let slot0 = await poolContract.slot0();
  const tickLow = pos.tickLower;
  const tickHigh = pos.tickUpper;

  let sqrtPriceX96 = slot0[0];
  let Decimal0 = await token0contract.decimals();
  let Decimal1 = await token1contract.decimals();

  // Get the correct token amounts
  // Depends on TickLow, tickHigh, sqrtPriceX96
  let sqrtRatioA = Math.sqrt(1.0001 ** tickLow);
  let sqrtRatioB = Math.sqrt(1.0001 ** tickHigh);

  let currentTick = getTickAtSqrtRatio(sqrtPriceX96);
  let sqrtPrice = sqrtPriceX96 / Q96;

  let amount0wei = 0;
  let amount1wei = 0;

  if (currentTick <= tickLow) {
    amount0wei = Math.floor(
      liquidity * ((sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB))
    );
  } else if (currentTick > tickHigh) {
    amount1wei = Math.floor(liquidity * (sqrtRatioB - sqrtRatioA));
  } else if (currentTick >= tickLow && currentTick < tickHigh) {
    amount0wei = Math.floor(
      liquidity * ((sqrtRatioB - sqrtPrice) / (sqrtPrice * sqrtRatioB))
    );
    amount1wei = Math.floor(liquidity * (sqrtPrice - sqrtRatioA));
  }

  // Amount 0 and 1 in readable formats
  const amount0Human = Math.abs(amount0wei / 10 ** Decimal0).toFixed(Decimal0);
  const amount1Human = Math.abs(amount1wei / 10 ** Decimal1).toFixed(Decimal1);

  console.log("Amount token 0: ", amount0Human);
  console.log("Amount token 1: ", amount1Human);

  // Convert to raw (wei) amounts
  const amount0Min = ethers.utils.parseUnits(amount0Human, Decimal0);
  const amount1Min = ethers.utils.parseUnits(amount1Human, Decimal1);

  // Apply slippage buffer (e.g., 3%)
  const slippagePercent = 0.03; // 3%
  const safeAmount0Min = amount0Min.mul(100 - slippagePercent * 100).div(100);
  const safeAmount1Min = amount1Min.mul(100 - slippagePercent * 100).div(100);

  const decreaseLiquidityData = iface.encodeFunctionData("decreaseLiquidity", [
    {
      tokenId: positionId,
      liquidity,
      amount0Min: safeAmount0Min,
      amount1Min: safeAmount1Min,
      deadline,
    },
  ]);

  const collectData = iface.encodeFunctionData("collect", [
    {
      tokenId: positionId,
      recipient: WALLET_ADDRESS,
      amount0Max: MaxUint128,
      amount1Max: MaxUint128,
    },
  ]);

  const multicallData = iface.encodeFunctionData("multicall", [
    [decreaseLiquidityData, collectData],
  ]);

  const tx = await wallet.sendTransaction({
    to: positionManagerAddress,
    data: multicallData,
    gasLimit: 500000,
    nonce: nonce, // <-- add this line
  });

  const receipt = await tx.wait(1);
  console.log("✅ Liquidity removed and tokens collected.");
  console.log("📤 TX Hash:", receipt.transactionHash);
  console.log("📦 Block Number:", receipt.blockNumber);
}

/********* MAIN ENTRY *********/
async function pullLP() {
  const nonce = await getNonce(); // for LP mint

  await removeLiquidity(nonce);
}

/********* EXPORT + STANDALONE *********/
module.exports = pullLP;

if (require.main === module) {
  pullLP().catch(console.error);
}
