/********* IMPORTS *********/
const { ethers } = require("ethers");
const { JsonRpcProvider } = require("ethers");
require("dotenv").config();
const fetch = require("node-fetch");
const fs = require("node:fs");
const JSBI = require("jsbi");
const { BigNumber } = require("ethers");
const ERC20ABI = require("./abi.json");
const { getNonce } = require("./helpers"); // import it

const baseTokenCA = "0x4200000000000000000000000000000000000006"; // WETH
const quoteTokenCA = "0x6a72d3a87f97a0fee2c2ee4233bdaebc32813d7a"; // ESX
const positionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const poolAddress = "0xc787ff6f332ee11b2c24fd8c112ac155f95b14ab";

/********* CONFIG *********/
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const WALLET_ADDRESS = process.env.MY_WALLET;
const WALLET_SECRET = process.env.MY_PK_DEV_WALLET;

const provider = new ethers.providers.JsonRpcProvider(
  `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
);
const wallet = new ethers.Wallet(WALLET_SECRET, provider);

const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const {
  abi: SwapRouterABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json");
const {
  abi: INonfungiblePositionManagerABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json");

const NonfungiblePositionContract = new ethers.Contract(
  positionManagerAddress,
  INonfungiblePositionManagerABI,
  provider
);

const poolContract = new ethers.Contract(
  poolAddress,
  IUniswapV3PoolABI,
  provider
);

let positionId;

const name0 = "Wrapped Ether",
  symbol0 = "WETH",
  decimals0 = 18,
  address0 = baseTokenCA;
const name1 = "ESX",
  symbol1 = "ESX",
  decimals1 = 9,
  address1 = quoteTokenCA;

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));

function getTickAtSqrtRatio(sqrtPriceX96) {
  let tick = Math.floor(Math.log((sqrtPriceX96 / Q96) ** 2) / Math.log(1.0001));
  return tick;
}

async function getPostions() {
  const numPositions = await NonfungiblePositionContract.balanceOf(
    WALLET_ADDRESS
  );
  console.log(numPositions.toString());

  const calls = [];
  for (let i = 0; i < numPositions; i++) {
    calls.push(
      NonfungiblePositionContract.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
    );
  }

  const positionIds = await Promise.all(calls);
  console.log(positionIds.toString());

  positionId = calls[numPositions - 1];
  let lastNFT = positionIds[numPositions - 1].toString();
  console.log("Last NFT: " + lastNFT);
  return lastNFT;
}

async function getFees(positionId) {
  var position = await NonfungiblePositionContract.positions(positionId);
  var token0contract = new ethers.Contract(position.token0, ERC20ABI, provider);
  var token1contract = new ethers.Contract(position.token1, ERC20ABI, provider);

  var Decimal0 = await token0contract.decimals();
  var Decimal1 = await token1contract.decimals();

  var token0sym = await token0contract.symbol();
  var token1sym = await token1contract.symbol();

  let slot0 = await poolContract.slot0();

  let tickLow = await poolContract.ticks(position.tickLower.toString());
  let tickHi = await poolContract.ticks(position.tickUpper.toString());

  let sqrtPriceX96 = slot0[0];

  let feeGrowthGlobal0 = await poolContract.feeGrowthGlobal0X128();
  let feeGrowthGlobal1 = await poolContract.feeGrowthGlobal1X128();

  let pairName = token0sym + "/" + token1sym;

  var PoolInfo = {
    Pair: pairName,
    sqrtPriceX96: sqrtPriceX96,
    tickCurrent: slot0.tick,
    tickLow: position.tickLower,
    tickHigh: position.tickUpper,
    liquidity: position.liquidity.toString(),
    feeGrowth0Low: tickLow.feeGrowthOutside0X128.toString(),
    feeGrowth0Hi: tickHi.feeGrowthOutside0X128.toString(),
    feeGrowth1Low: tickLow.feeGrowthOutside1X128.toString(),
    feeGrowth1Hi: tickHi.feeGrowthOutside1X128.toString(),
    feeGrowthInside0LastX128: position.feeGrowthInside0LastX128.toString(),
    feeGrowthInside1LastX128: position.feeGrowthInside1LastX128.toString(),
    feeGrowthGlobal0X128: feeGrowthGlobal0.toString(),
    feeGrowthGlobal1X128: feeGrowthGlobal1.toString(),
  };

  return PoolInfo;
}

async function getTokenAmounts(
  liquidity,
  sqrtPriceX96,
  tickLow,
  tickHigh,
  Decimal0,
  Decimal1
) {
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

  amount0Human = Math.abs(amount0wei / 10 ** Decimal0).toFixed(Decimal0);
  amount1Human = Math.abs(amount1wei / 10 ** Decimal1).toFixed(Decimal1);

  console.log("Amount token 0: ", amount0Human);
  console.log("Amount token 1: ", amount1Human);

  return [amount0wei, amount1wei];
}

async function getLiquidity() {
  const id = await getPostions();
  const PoolInfo = await getFees(id);
  const tokens = await getTokenAmounts(
    PoolInfo.liquidity,
    PoolInfo.sqrtPriceX96,
    PoolInfo.tickLow,
    PoolInfo.tickHigh,
    decimals0,
    decimals1
  );

  if (PoolInfo.liquidity === "0") {
    console.log("⚠️ No liquidity in position.");
    return 0;
  }

  if (
    PoolInfo.tickCurrent >= PoolInfo.tickLow &&
    PoolInfo.tickCurrent <= PoolInfo.tickHigh
  ) {
    console.log("LP still in range");
    LPinRange = 1;
  } else if (PoolInfo.tickCurrent < PoolInfo.tickLow) {
    console.log("LP out of range (< tickLow): position in WETH");
    LPinRange = 2;
  } else if (PoolInfo.tickCurrent > PoolInfo.tickHigh) {
    console.log("LP out of range (> tickHigh): position in ESX");
    LPinRange = 3;
  }

  console.log(PoolInfo.tickCurrent);
  console.log(PoolInfo.tickLow);
  console.log(PoolInfo.tickHigh);

  return LPinRange;
}

// ✅ Exported function for use in master bot
async function getPosition() {
  const LPinRange = await getLiquidity(); // getLiquidity must return a value!
  return LPinRange;
}

module.exports = getPosition;

// ✅ Optional: allow standalone execution
if (require.main === module) {
  getPosition().catch(console.error);
}
