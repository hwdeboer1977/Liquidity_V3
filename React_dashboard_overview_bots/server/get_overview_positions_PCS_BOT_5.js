// Script to get overview of Pancakeswap Bot 1
const { ethers } = require("ethers");
const {
  ChainId,
  Token,
  TokenAmount,
  Fetcher,
  Pair,
  Route,
  Trade,
  TradeType,
  Percent,
} = require("@pancakeswap-libs/sdk");
const { JsonRpcProvider } = require("@ethersproject/providers");
const ERC20ABI = require("./abis/erc20.json");
const MASTERCHEFABI = require("./abis/masterchefv3.json");
const JSBI = require("jsbi");
const {
  NonfungiblePositionManager,
  quoterABI,
} = require("@pancakeswap/v3-sdk");
const {
  INonfungiblePositionManagerABI,
} = require("./abis/NonfungiblePositionManager.json");
const { TickMath, FullMath, TickList } = require("@pancakeswap/v3-sdk");
const { Pool, Position, nearestUsableTick } = require("@pancakeswap/v3-sdk");
const fs = require("node:fs");

const artifacts = {
  INonfungiblePositionManager: require("./abis/NonfungiblePositionManager.json"),
};

const smartRouterAbi = require("./abis/pancakeSmartRouter.json");
const pancakeV3PoolABI = require("./abis/IPancakeV3Pool.json");

require("dotenv").config();
const WALLET_ADDRESS = process.env.WALLET_ADDRESS_PCS_5;

const BOT_VERSION = "PCS_BOT_5";

// Token addresses BSC Mainnet
const baseTokenCA = "0x55d398326f99059ff775485246999027b3197955"; // USDT
const quoteTokenCA = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c"; // BTCB
const cakeToken = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"; // CAKE
const wbnbTokenCA = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"; // WBNB

const decimalsBase = 1000000000000000000; // USDT
const decimalsQuote = 1000000000000000000; // BTCB

// Pancakeswap addresses:
// We kiezen pool met hoogste liquidity als pool om te swappen
// Pancakeswap addresses:
// We kiezen pool met hoogste liquidity als pool om te swappen
const poolAddress = "0x46cf1cf8c69595804ba91dfdd8d6b960c9b0a7c4";
const positionManagerAddress = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364"; // NonfungiblePositionManager
const PancakeV3Factory = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
const swapRouterAddress = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4";
const masterChefV3 = "0x556B9306565093C855AEA9AE92A594704c2Cd59e";
const poolAddressCake = "0x7f51c8aaa6b0599abd16674e2b17fec7a9f674a1";
const poolAddressBNB = "0x172fcd41e0913e95784454622d1c3724f546f849"; // fee 500

// Let op: bij UNI=>WETH en WETH=>UNI moet je dit wel omdraaien voor de juiste approval
const name0 = "USDT";
const symbol0 = "USDT";
const decimals0 = 18;
const address0 = baseTokenCA;

const name1 = "BTC";
const symbol1 = "BTCB";
const decimals1 = 18;
const address1 = quoteTokenCA;

const chainId = 56; // Binance Smart Chain mainnet
const BaseToken = new Token(chainId, address0, decimals0, symbol0, name0);
const quoteToken = new Token(chainId, address1, decimals1, symbol1, name1);

// Initialize variables
let currentPrice = 0;
var currentPriceBNB = 0;
var currentPriceBTC = 0;
var currentPriceUSDT = 1;
var currentPriceCake = 0;
let sqrtPriceX96 = 0;

var balanceBNB = 0;
var balanceBaseToken = 0;
var balanceQuoteToken = 0;
var balanceCakeToken = 0;

var currentValueUSD_tmp1 = 0;
var currentValueUSD_tmp2 = 0;
var currentValueUSD_tmp3 = 0;
var currentValueUSD_tmp4 = 0;
var currentValueUSD = 0;

var amountCake = 0;
var valueCAKEUSD = 0;

var uncollectedFeesAdjusted_0 = 0;
var uncollectedFeesAdjusted_1 = 0;
var feeAmount0USD = 0;
var feeAmount1USD = 0;

var amount0Human = 0;
var amount1Human = 0;
var amount0USD = 0;
var amount1USD = 0;

let usdValueBNB = 0;
let usdValueBTC = 0;
let usdValueUSDT = 0;
let usdValueBTCBot = 0;

let usdValueAll = 0;
let usdValueUSDTBot = 0;
let usdValueBTCFee = 0;
let usdValueUSDTFee = 0;
let usdValueCAKEW = 0;
let usdValueBNBW = 0;
let usdValueBTCW = 0;
let usdValueUSDTW = 0;
let usdValueCAKEFee = 0;
let usdValueCAKE = 0;
let usdValueBotAll = 0;
let usdValueWalletAll = 0;

const provider = new ethers.providers.JsonRpcProvider(
  "https://bsc-dataseed1.binance.org:443"
);

const ABI = ["function balanceOf(address account) view returns (uint256)"];

const contractBaseToken = new ethers.Contract(baseTokenCA, ABI, provider);
const contractQuoteToken = new ethers.Contract(quoteTokenCA, ABI, provider);
const contractCakeToken = new ethers.Contract(cakeToken, ABI, provider);
const contractWBNBToken = new ethers.Contract(wbnbTokenCA, ABI, provider);

const NonfungiblePositionContract = new ethers.Contract(
  positionManagerAddress,
  artifacts.INonfungiblePositionManager,
  provider
);

const masterChefContract = new ethers.Contract(
  masterChefV3,
  MASTERCHEFABI,
  provider
);

// Get information from pool
let tokenContract0 = new ethers.Contract(address0, ERC20ABI, provider);
let tokenContract1 = new ethers.Contract(address1, ERC20ABI, provider);

async function getPoolData(poolContract) {
  let [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  // Get the relevant Tick from etherscan
  tickPrice = slot0[1];
  sqrtPriceX96 = slot0[0];
  currentPrice = (Math.pow(1.0001, tickPrice) * decimalsBase) / decimalsQuote;

  return {
    tickSpacing: tickSpacing,
    fee: fee,
    liquidity: liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
    tickPrice,
    sqrtPriceX96,
    currentPrice,
  };
}

// Create 2 poolcontracts ethers
const poolContract = new ethers.Contract(
  poolAddress,
  pancakeV3PoolABI,
  provider
);

const poolContractCake = new ethers.Contract(
  poolAddressCake,
  pancakeV3PoolABI,
  provider
);

const poolContractWbnb = new ethers.Contract(
  poolAddressBNB,
  pancakeV3PoolABI,
  provider
);

async function readBalanceWallet() {
  // Inlezen balans (alle coins) van de wallet
  const poolData = await getPoolData(poolContract);
  currentPriceBTC = currentPrice;
  console.log("current Price BTC: " + currentPriceBTC);

  const poolDataCake = await getPoolData(poolContractCake);
  currentPriceCake = currentPrice;
  console.log("current Price CAKE: " + currentPriceCake);

  const poolDataWbnb = await getPoolData(poolContractWbnb);
  currentPriceBNB = currentPrice;
  console.log("current Price BNB: " + currentPriceBNB);

  balanceBNB = await provider.getBalance(WALLET_ADDRESS);
  console.log("Balance BNB: " + balanceBNB / decimalsBase);

  const balanceInWei2 = await contractQuoteToken.balanceOf(WALLET_ADDRESS);
  balanceQuoteToken =
    ethers.utils.formatEther(balanceInWei2) * (decimalsBase / decimalsQuote);

  console.log(`Balance ${name1}: ` + balanceQuoteToken);

  const balanceInWei3 = await contractBaseToken.balanceOf(WALLET_ADDRESS);
  balanceBaseToken = ethers.utils.formatEther(balanceInWei3);
  console.log(`Balance ${name0}: ` + balanceBaseToken);

  const balanceInWei4 = await contractCakeToken.balanceOf(WALLET_ADDRESS);
  balanceCakeToken = ethers.utils.formatEther(balanceInWei4);
  console.log(`Balance Cake: ` + balanceCakeToken);

  //Read current price and sqrtPriceX96
  await getPoolData(poolContract);

  //let currentValueUSD_tmp1 = parseInt((balanceBNB / decimalsBase) * (1/currentPrice))
  currentValueUSD_tmp1 = Number(
    (balanceBNB / decimalsBase) * (1 / currentPriceBNB)
  );
  currentValueUSD_tmp2 = Number(balanceBaseToken * (1 / currentPriceUSDT));
  currentValueUSD_tmp3 = Number(balanceQuoteToken * (1 / currentPriceBTC));
  currentValueUSD_tmp4 = Number(balanceCakeToken * currentPriceCake);

  currentValueUSD = (
    currentValueUSD_tmp1 +
    currentValueUSD_tmp2 +
    currentValueUSD_tmp3 +
    currentValueUSD_tmp4
  ).toFixed(2);

  const writeBalances = `Amount BNB:  ${
    balanceBNB / decimalsBase
  }, Amount USDT:  ${balanceBaseToken}, Amount BTC:  ${balanceQuoteToken}, Amount Cake: ${balanceCakeToken}  and total USD value: ${currentValueUSD}`;

  // USD values
  currentPrice = (Math.pow(1.0001, tickPrice) * decimalsBase) / decimalsQuote;
}

// Function to read the pending fees in LP
async function readBalancePending() {
  // Read the NFT is (V3 LP is an ERC721 token)
  async function readInfoLPID() {
    let lastNFT = await fs.promises.readFile("NFT_PCS_BSC_BOT_5.txt", "utf8");
    return lastNFT;
  }

  lastNFT = parseInt(await readInfoLPID());

  // Total number of positions (open and closed)
  const numPositions = await NonfungiblePositionContract.balanceOf(
    WALLET_ADDRESS
  );

  // Alle IDs in vector stoppen: laatste ID is dan actief nog
  const calls = [];

  for (let i = 0; i < numPositions; i++) {
    calls.push(
      NonfungiblePositionContract.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
    );
  }

  // Add current LP
  calls.push(lastNFT);

  const positionIds = await Promise.all(calls);

  const positionId = calls[numPositions];

  console.log(positionId);

  amountCake =
    (await masterChefContract.pendingCake(positionId)) / decimalsBase;
  console.log("Number of cakes pending: " + amountCake);

  valueCAKEUSD = amountCake * currentPriceCake;
  console.log("Value of cakes pending: " + valueCAKEUSD);

  var position = await NonfungiblePositionContract.positions(positionId);

  var token0contract = new ethers.Contract(position.token0, ERC20ABI, provider);
  var token1contract = new ethers.Contract(position.token1, ERC20ABI, provider);

  var Decimal0 = await token0contract.decimals();
  var Decimal1 = await token1contract.decimals();

  var token0sym = await token0contract.symbol();
  var token1sym = await token1contract.symbol();

  // function to get the data on this LP position
  async function getData(positionId) {
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

  const ZERO = JSBI.BigInt(0);
  const Q128 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(128));
  const Q256 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(256));

  function toBigNumber(numstr) {
    let bi = numstr;
    if (typeof sqrtRatio !== "bigint") {
      bi = JSBI.BigInt(numstr);
    }
    return bi;
  }

  function subIn256(x, y) {
    const difference = JSBI.subtract(x, y);

    if (JSBI.lessThan(difference, ZERO)) {
      return JSBI.add(Q256, difference);
    } else {
      return difference;
    }
  }

  // This function reads all the fees (see documentation uniswap V3)
  async function getFees(
    feeGrowthGlobal0,
    feeGrowthGlobal1,
    feeGrowth0Low,
    feeGrowth0Hi,
    feeGrowthInside0,
    feeGrowth1Low,
    feeGrowth1Hi,
    feeGrowthInside1,
    liquidity,
    decimals0,
    decimals1,
    tickLower,
    tickUpper,
    tickCurrent
  ) {
    let feeGrowthGlobal_0 = toBigNumber(feeGrowthGlobal0);
    let feeGrowthGlobal_1 = toBigNumber(feeGrowthGlobal1);

    //console.log("feeGrowthGlobal_0:" + feeGrowthGlobal_0)
    //console.log("feeGrowthGlobal_1:" + feeGrowthGlobal_1)

    let tickLowerFeeGrowthOutside_0 = toBigNumber(feeGrowth0Low);
    let tickLowerFeeGrowthOutside_1 = toBigNumber(feeGrowth1Low);

    //console.log("tickLowerFeeGrowthOutside_0:" + tickLowerFeeGrowthOutside_0)
    //console.log("tickLowerFeeGrowthOutside_1:" + tickLowerFeeGrowthOutside_1)

    let tickUpperFeeGrowthOutside_0 = toBigNumber(feeGrowth0Hi);
    let tickUpperFeeGrowthOutside_1 = toBigNumber(feeGrowth1Hi);

    //console.log("tickUpperFeeGrowthOutside_0:" + tickUpperFeeGrowthOutside_0)
    //console.log("tickUpperFeeGrowthOutside_1:" + tickUpperFeeGrowthOutside_1)

    let tickLowerFeeGrowthBelow_0 = ZERO;
    let tickLowerFeeGrowthBelow_1 = ZERO;
    let tickUpperFeeGrowthAbove_0 = ZERO;
    let tickUpperFeeGrowthAbove_1 = ZERO;

    //console.log("tickCurrent: " +  tickCurrent)
    //console.log("tickUpper: " + tickUpper)
    //console.log("tickLower: " +tickLower)

    if (tickCurrent >= tickUpper) {
      tickUpperFeeGrowthAbove_0 = subIn256(
        feeGrowthGlobal_0,
        tickUpperFeeGrowthOutside_0
      );
      tickUpperFeeGrowthAbove_1 = subIn256(
        feeGrowthGlobal_1,
        tickUpperFeeGrowthOutside_1
      );
    } else {
      tickUpperFeeGrowthAbove_0 = tickUpperFeeGrowthOutside_0;
      tickUpperFeeGrowthAbove_1 = tickUpperFeeGrowthOutside_1;
    }

    if (tickCurrent >= tickLower) {
      tickLowerFeeGrowthBelow_0 = tickLowerFeeGrowthOutside_0;
      tickLowerFeeGrowthBelow_1 = tickLowerFeeGrowthOutside_1;
    } else {
      tickLowerFeeGrowthBelow_0 = subIn256(
        feeGrowthGlobal_0,
        tickLowerFeeGrowthOutside_0
      );
      tickLowerFeeGrowthBelow_1 = subIn256(
        feeGrowthGlobal_1,
        tickLowerFeeGrowthOutside_1
      );
    }

    //console.log("tickLowerFeeGrowthBelow_0: " + tickLowerFeeGrowthBelow_0)
    //console.log("tickLowerFeeGrowthBelow_1: " + tickLowerFeeGrowthBelow_1)
    //console.log("tickUpperFeeGrowthAbove_0: " + tickUpperFeeGrowthAbove_0)
    //console.log("tickUpperFeeGrowthAbove_1: " + tickUpperFeeGrowthAbove_1)

    let fr_t1_0 = subIn256(
      subIn256(feeGrowthGlobal_0, tickLowerFeeGrowthBelow_0),
      tickUpperFeeGrowthAbove_0
    );
    let fr_t1_1 = subIn256(
      subIn256(feeGrowthGlobal_1, tickLowerFeeGrowthBelow_1),
      tickUpperFeeGrowthAbove_1
    );

    let feeGrowthInsideLast_0 = toBigNumber(feeGrowthInside0);
    let feeGrowthInsideLast_1 = toBigNumber(feeGrowthInside1);

    //console.log("feeGrowthInsideLast_0:" + feeGrowthInsideLast_0)
    //console.log("feeGrowthInsideLast_1:" + feeGrowthInsideLast_1)

    let uncollectedFees_0 =
      (liquidity * subIn256(fr_t1_0, feeGrowthInsideLast_0)) / Q128;

    let uncollectedFees_1 =
      (liquidity * subIn256(fr_t1_1, feeGrowthInsideLast_1)) / Q128;

    //console.log("uncollectedFees_0: " + uncollectedFees_0)
    //console.log("uncollectedFees_1: " + uncollectedFees_1)

    uncollectedFeesAdjusted_0 = (
      uncollectedFees_0 / toBigNumber(10 ** Decimal0)
    ).toFixed(Decimal0);

    uncollectedFeesAdjusted_1 = (
      uncollectedFees_1 / toBigNumber(10 ** Decimal1)
    ).toFixed(Decimal1);

    //console.log("uncollectedFeesAdjusted_0: " + uncollectedFeesAdjusted_0)
    //console.log("uncollectedFeesAdjusted_1: " + uncollectedFeesAdjusted_1)

    feeAmount0USD = uncollectedFeesAdjusted_0 * (1 / currentPriceUSDT);
    feeAmount1USD = uncollectedFeesAdjusted_1 * (1 / currentPriceBTC);

    //console.log("feeAmount0USD: " + feeAmount0USD)
    //console.log("feeAmount1USD: " + feeAmount1USD)
  }

  async function readFees(positionId) {
    //var PoolInfo = await getData(positionId);

    var Fees = await getFees(
      PoolInfo.feeGrowthGlobal0X128,
      PoolInfo.feeGrowthGlobal1X128,
      PoolInfo.feeGrowth0Low,
      PoolInfo.feeGrowth0Hi,
      // Deze is 0
      PoolInfo.feeGrowthInside0LastX128,
      PoolInfo.feeGrowth1Low,
      PoolInfo.feeGrowth1Hi,
      // Deze is 0
      PoolInfo.feeGrowthInside1LastX128,
      PoolInfo.liquidity,
      // Deze is undefined
      PoolInfo.Decimal0,
      // Deze is undefined
      PoolInfo.Decimal1,
      PoolInfo.tickLow,
      PoolInfo.tickHigh,
      PoolInfo.tickCurrent
    );

    //return [PoolInfo, Fees]
  }

  const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));

  function getTickAtSqrtRatio(sqrtPriceX96) {
    let tick = Math.floor(
      Math.log((sqrtPriceX96 / Q96) ** 2) / Math.log(1.0001)
    );
    return tick;
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
    amount0USD = amount0Human * (1 / currentPriceUSDT);
    amount1USD = amount1Human * (1 / currentPriceBTC);

    return [amount0wei, amount1wei];
  }

  // Liquidity positie ophalen
  async function readLiquidity(positionId) {
    let PoolInfo = await getData(positionId);
    let tokens = await getTokenAmounts(
      PoolInfo.liquidity,
      PoolInfo.sqrtPriceX96,
      PoolInfo.tickLow,
      PoolInfo.tickHigh,
      Decimal0,
      Decimal1
    );
  }

  await readLiquidity(positionId);

  let PoolInfo = await getData(positionId);
  readFees(positionId);
}

// Function to write output to txt file
async function writeOutput() {
  console.log("currentPriceBNB: " + currentPriceBNB);
  console.log("currentPriceUSDT: " + currentPriceUSDT);
  console.log("currentPriceCake: " + currentPriceCake);
  console.log("currentPriceBTC: " + currentPriceBTC);

  console.log("balanceBNB: " + balanceBNB / decimalsQuote);
  console.log("balanceBaseToken: " + balanceBaseToken);
  console.log("balanceQuoteToken: " + balanceQuoteToken);
  console.log("balanceCakeToken: " + balanceCakeToken);

  console.log("USD value BNB in wallet: " + currentValueUSD_tmp1);
  console.log("USD value USDT in wallet: " + currentValueUSD_tmp2);
  console.log("USD value BTC in wallet: " + currentValueUSD_tmp3);
  console.log("USD value CAKE in wallet: " + currentValueUSD_tmp4);
  console.log("USD value all in wallet: " + currentValueUSD);

  console.log("Amount Cake pending: " + amountCake);
  console.log("USD value Cake pending: " + valueCAKEUSD);

  console.log("Amount liquidity USDT: " + amount0Human);
  console.log("Amount liquidity BTC: " + amount1Human * (1 / currentPriceBTC));
  console.log("USD value liquidity USDT: " + amount0USD);
  console.log("USD value liquidity BTC: " + amount1USD);

  console.log("Amount fees USDT: " + uncollectedFeesAdjusted_0);
  console.log("Amount fees BTC: " + uncollectedFeesAdjusted_1);
  console.log("USD value fees USDT: " + feeAmount0USD);
  console.log("USD value fees BTC: " + feeAmount1USD);

  usdValueBNB = currentValueUSD_tmp1;
  usdValueBTC = currentValueUSD_tmp2 + amount0USD + feeAmount0USD;
  usdValueUSDT = currentValueUSD_tmp3 + amount1USD + feeAmount1USD;
  usdValueCAKE = currentValueUSD_tmp4 + valueCAKEUSD;

  usdValueAll = usdValueBNB + usdValueBTC + usdValueUSDT + usdValueCAKE;
  usdValueBNB = currentValueUSD_tmp1.toFixed(0);
  usdValueBTC = (currentValueUSD_tmp2 + amount0USD + feeAmount0USD).toFixed(0);
  usdValueUSDT = (currentValueUSD_tmp3 + amount1USD + feeAmount1USD).toFixed(0);

  usdValueBNB = currentValueUSD_tmp1.toFixed(0);
  usdValueBTC = (currentValueUSD_tmp2 + amount0USD + feeAmount0USD).toFixed(0);
  usdValueUSDT = (currentValueUSD_tmp3 + amount1USD + feeAmount1USD).toFixed(0);
  usdValueCAKE = (currentValueUSD_tmp4 + valueCAKEUSD).toFixed(0);

  usdValueBNBW = currentValueUSD_tmp1.toFixed(0);
  usdValueBTCW = currentValueUSD_tmp2.toFixed(0);
  usdValueUSDTW = currentValueUSD_tmp3.toFixed(0);
  usdValueCAKEW = currentValueUSD_tmp4.toFixed(0);

  usdValueBTCFee = feeAmount1USD.toFixed(0);
  usdValueUSDTFee = feeAmount0USD.toFixed(0);
  usdValueCAKEFee = valueCAKEUSD.toFixed(0);

  usdValueBTCBot = amount0USD.toFixed(0);
  usdValueUSDTBot = amount1USD.toFixed(0);

  usdValueBotAll = (
    amount0USD +
    amount1USD +
    feeAmount1USD +
    feeAmount0USD +
    valueCAKEUSD
  ).toFixed(0);
  usdValueWalletAll = (
    currentValueUSD_tmp1 +
    currentValueUSD_tmp2 +
    currentValueUSD_tmp3 +
    currentValueUSD_tmp4
  ).toFixed(0);

  usdValueAll = (
    parseFloat(usdValueBNB) +
    parseFloat(usdValueBTC) +
    parseFloat(usdValueUSDT) +
    parseFloat(usdValueCAKE)
  ).toFixed(0);
}

async function readValue() {
  await readBalanceWallet();

  await readBalancePending();

  await writeOutput();
}
let exportUsdValueAll = 0;
let exportUsdValueBNB = 0;
let exportUsdValueBTC = 0;
let exportUsdValueUSDT = 0;
let exportUsdValueCAKEFee = 0;
let exportUsdValueBTCBot = 0;
let exportUsdValueUSDTBot = 0;
let exportUsdValueBTCFee = 0;
let exportUsdValueUSDTFee = 0;
let exportUsdValueCAKEW = 0;
let exportUsdValueBNBW = 0;
let exportUsdValueBTCW = 0;
let exportUsdValueUSDTW = 0;
let exportUsdValueCAKE = 0;
let exportUsdValueBotAll = 0;
let exportUsdValueWalletAll = 0;

// Define a function to perform the asynchronous operation and update someVariable
async function waitResult5(callback) {
  await readValue().then(() => {
    exportUsdValueAll = usdValueAll; // Update the global variable with the correct value
    exportUsdValueBNB = usdValueBNB;
    exportUsdValueBTC = usdValueBTC;
    exportUsdValueUSDT = usdValueUSDT;
    exportUsdValueCAKEFee = usdValueCAKEFee;
    exportUsdValueBTCBot = usdValueBTCBot;
    exportUsdValueUSDTBot = usdValueUSDTBot;
    exportUsdValueBTCFee = usdValueBTCFee;
    exportUsdValueUSDTFee = usdValueUSDTFee;
    exportUsdValueCAKEW = usdValueCAKEW;
    exportUsdValueBNBW = usdValueBNBW;
    exportUsdValueBTCW = usdValueBTCW;
    exportUsdValueUSDTW = usdValueUSDTW;
    exportUsdValueCAKE = usdValueCAKE;
    exportUsdValueBotAll = usdValueBotAll;
    exportUsdValueWalletAll = usdValueWalletAll;
    //console.log(exportUsdValueAll);
    //console.log(exportUsdValueBNB);
    callback(
      exportUsdValueAll,
      exportUsdValueBNB,
      exportUsdValueBTC,
      exportUsdValueUSDT,
      exportUsdValueCAKEFee,
      exportUsdValueBTCBot,
      exportUsdValueUSDTBot,
      exportUsdValueBTCFee,
      exportUsdValueUSDTFee,
      exportUsdValueCAKEW,
      exportUsdValueBNBW,
      exportUsdValueBTCW,
      exportUsdValueUSDTW,
      exportUsdValueCAKE,
      exportUsdValueBotAll,
      exportUsdValueWalletAll
    ); // Call the callback function with someVariable as argument
  });
}

module.exports = {
  readValue,
  waitResult5,
  exportUsdValueAll,
  exportUsdValueBNB,
  exportUsdValueBTC,
  exportUsdValueUSDT,
  exportUsdValueCAKEFee,
  exportUsdValueBTCBot,
  exportUsdValueUSDTBot,
  exportUsdValueBTCFee,
  exportUsdValueUSDTFee,
  exportUsdValueCAKEW,
  exportUsdValueBNBW,
  exportUsdValueBTCW,
  exportUsdValueUSDTW,
  exportUsdValueBotAll,
  exportUsdValueWalletAll,
};
