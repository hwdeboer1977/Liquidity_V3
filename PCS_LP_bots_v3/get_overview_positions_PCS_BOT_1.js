// Script to get all relevant information for the current open LP position
// This script is for a USDT/WBNB pair on Pancakeswap, and on BSC chain

// Import necessary modules
const { ethers } = require("ethers");
const excel = require("excel4node"); // For generating Excel reports
const ERC20ABI = require("./abis/erc20.json"); // ERC20 standard ABI
const MASTERCHEFABI = require("./abis/masterchefv3.json"); // ABI for PancakeSwap MasterChef V3
const JSBI = require("jsbi"); // Library for handling BigInt calculations
const fs = require("node:fs"); // File system module for reading/writing files

// Import Pancakeswap ABIs
const artifacts = {
  INonfungiblePositionManager: require("./abis/NonfungiblePositionManager.json"),
};

// Import PancakeV3Pool ABI
const pancakeV3PoolABI = require("./abis/IPancakeV3Pool.json");

// Load environment variables for sensitive data like wallet address
require("dotenv").config();
const WALLET_ADDRESS = process.env.WALLET_ADDRESS_PCS_1;

// Bot version identifier
const BOT_VERSION = "PCS_BOT_1";

// Token addresses on BSC Mainnet
const baseTokenCA = "0x55d398326f99059ff775485246999027b3197955"; // USDT
const quoteTokenCA = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"; // WBNB
const cakeToken = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"; // CAKE

// Decimals for token calculations
const decimalsBase = 10 ** 18; // USDT
const decimalsQuote = 10 ** 18; // WBNB

// Pancakeswap contract addresses
const poolAddress = "0x172fcd41e0913e95784454622d1c3724f546f849"; // USDT-WBNB pool
const positionManagerAddress = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364"; // NonfungiblePositionManager
const masterChefV3 = "0x556B9306565093C855AEA9AE92A594704c2Cd59e"; // MasterChef V3
const poolAddressCake = "0x7f51c8aaa6b0599abd16674e2b17fec7a9f674a1"; // Pool for CAKE

// Token names for display
const name0 = "USDT";
const name1 = "Wrapped BNB";

// Binance Smart Chain (BSC) mainnet chain ID
const chainId = 56;

// Initialize variables for storing token balances, fees, and USD values
let currentPrice = 0;
let sqrtPriceX96 = 0;
var currentPriceBNB = 0;
var currentPriceUSDT = 1; // Fixed as USDT is pegged to USD
var currentPriceCake = 0;

// Balances and calculated USD values
var balanceBNB = 0;
var balanceBaseToken = 0;
var balanceQuoteToken = 0;
var balanceCakeToken = 0;

var currentValueUSD_tmp1 = 0;
var currentValueUSD_tmp2 = 0;
var currentValueUSD_tmp3 = 0;
var currentValueUSD_tmp4 = 0;
var currentValueUSD = 0;

// Pending rewards and fees
var amountCake = 0;
var valueCAKEUSD = 0;

var uncollectedFeesAdjusted_0 = 0;
var uncollectedFeesAdjusted_1 = 0;
var feeAmount0USD = 0;
var feeAmount1USD = 0;

// Amounts in liquidity pool
var amount0Human = 0;
var amount1Human = 0;
var amount0USD = 0;
var amount1USD = 0;

// Provider for interacting with the BSC blockchain
const provider = new ethers.providers.JsonRpcProvider(
  "https://bsc-dataseed1.binance.org:443"
);

// Basic ABI to fetch balances
const ABI = ["function balanceOf(address account) view returns (uint256)"];

// Create ethers contracts for interacting with tokens
const contractBaseToken = new ethers.Contract(baseTokenCA, ABI, provider); // USDT
const contractQuoteToken = new ethers.Contract(quoteTokenCA, ABI, provider); // WBNB
const contractCakeToken = new ethers.Contract(cakeToken, ABI, provider); // CAKE

// Create instances for Pancakeswap contracts
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

// Function to fetch pool data such as liquidity, current price, and ticks
async function getPoolData(poolContract) {
  let [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(),
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  // Calculate the current price from the tick
  tickPrice = slot0[1];
  sqrtPriceX96 = slot0[0];
  currentPrice = (Math.pow(1.0001, tickPrice) * decimalsBase) / decimalsQuote;

  return {
    tickSpacing,
    fee,
    liquidity,
    sqrtPriceX96,
    tick: slot0[1],
    tickPrice,
    currentPrice,
  };
}

// Instances for pool contracts (main pool and CAKE pool)
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

// Function to read wallet balances for relevant tokens
async function readBalanceWallet() {
  // Fetch pool data for main pool and CAKE pool
  const poolData = await getPoolData(poolContract);
  currentPriceBNB = currentPrice;
  console.log("current Price BNB: " + currentPriceBNB);

  const poolDataCake = await getPoolData(poolContractCake);
  currentPriceCake = currentPrice;
  console.log("current Price CAKE: " + currentPriceCake);

  // Fetch wallet balances for native BNB and tokens
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

  // Calculate USD values based on current prices
  currentValueUSD_tmp1 = (balanceBNB / decimalsBase) * (1 / currentPriceBNB);
  currentValueUSD_tmp2 = balanceBaseToken * (1 / currentPriceUSDT);
  currentValueUSD_tmp3 = balanceQuoteToken * (1 / currentPriceBNB);
  currentValueUSD_tmp4 = balanceCakeToken * currentPriceCake;

  currentValueUSD = (
    currentValueUSD_tmp1 +
    currentValueUSD_tmp2 +
    currentValueUSD_tmp3 +
    currentValueUSD_tmp4
  ).toFixed(2);

  // Log summary of wallet balances and total USD value
  const writeBalances = `Amount BNB: ${
    balanceBNB / decimalsBase
  }, Amount USDT: ${balanceBaseToken}, Amount WBNB: ${balanceQuoteToken}, Amount Cake: ${balanceCakeToken} and total USD value: ${currentValueUSD}`;
  console.log(writeBalances);
}

// Function to read the pending rewards (trading fees) from Pancakeswap
async function readBalancePending() {
  // We saved the NFT ID when we opened the LP position
  // V3 LP position is an ERC721!
  async function readInfoLPID() {
    let lastNFT = await fs.promises.readFile("NFT_PCS_BSC_BOT_1.txt", "utf8"); // txt file gets ERC721 token ID of LP
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

  // Function get the data
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

  // Function to retrieve the accrued fees
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

    let tickUpperFeeGrowthOutside_0 = toBigNumber(feeGrowth0Hi);
    let tickUpperFeeGrowthOutside_1 = toBigNumber(feeGrowth1Hi);

    let tickLowerFeeGrowthBelow_0 = ZERO;
    let tickLowerFeeGrowthBelow_1 = ZERO;
    let tickUpperFeeGrowthAbove_0 = ZERO;
    let tickUpperFeeGrowthAbove_1 = ZERO;

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

    let uncollectedFees_0 =
      (liquidity * subIn256(fr_t1_0, feeGrowthInsideLast_0)) / Q128;

    let uncollectedFees_1 =
      (liquidity * subIn256(fr_t1_1, feeGrowthInsideLast_1)) / Q128;

    uncollectedFeesAdjusted_0 = (
      uncollectedFees_0 / toBigNumber(10 ** Decimal0)
    ).toFixed(Decimal0);

    uncollectedFeesAdjusted_1 = (
      uncollectedFees_1 / toBigNumber(10 ** Decimal1)
    ).toFixed(Decimal1);

    feeAmount0USD = uncollectedFeesAdjusted_0 * (1 / currentPriceUSDT);
    feeAmount1USD = uncollectedFeesAdjusted_1 * (1 / currentPriceBNB);
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
    amount1USD = amount1Human * (1 / currentPriceBNB);

    return [amount0wei, amount1wei];
  }

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

// Function to write all relevant output to txt file
async function writeOutput() {
  console.log("currentPriceBNB: " + currentPriceBNB);
  console.log("currentPriceUSDT: " + currentPriceUSDT);
  console.log("currentPriceCake: " + currentPriceCake);

  console.log("balanceBNB: " + balanceBNB / decimalsQuote);
  console.log("balanceBaseToken: " + balanceBaseToken);
  console.log("balanceQuoteToken: " + balanceQuoteToken);
  console.log("balanceCakeToken: " + balanceCakeToken);

  console.log("USD value BNB in wallet: " + currentValueUSD_tmp1);
  console.log("USD value USDT in wallet: " + currentValueUSD_tmp2);
  console.log("USD value WBNB in wallet: " + currentValueUSD_tmp3);
  console.log("USD value CAKE in wallet: " + currentValueUSD_tmp4);
  console.log("USD value all in wallet: " + currentValueUSD);

  console.log("Amount Cake pending: " + amountCake);
  console.log("USD value Cake pending: " + valueCAKEUSD);

  console.log("Amount liquidity USDT: " + amount0Human);
  console.log("Amount liquidity WBNB: " + amount1Human);
  console.log("USD value liquidity USDT: " + amount0USD);
  console.log("USD value liquidity WBNB: " + amount1USD);

  console.log("Amount fees USDT: " + uncollectedFeesAdjusted_0);
  console.log("Amount fees WBNB: " + uncollectedFeesAdjusted_1);
  console.log("USD value fees USDT: " + feeAmount0USD);
  console.log("USD value fees WBNB: " + feeAmount1USD);
}

// Function to write output to Excel
async function writeOutputExcel() {
  let date_ob = new Date();

  // current date
  // adjust 0 before single digit date
  let date = ("0" + date_ob.getDate()).slice(-2);

  // current month
  let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);

  // current year
  let year = date_ob.getFullYear();

  // current hours
  let hours = date_ob.getHours();

  // current minutes
  let minutes = date_ob.getMinutes();

  // current seconds
  let seconds = date_ob.getSeconds();

  // prints date & time in YYYY-MM-DD HH:MM:SS format
  console.log(
    year +
      "-" +
      month +
      "-" +
      date +
      " " +
      hours +
      ":" +
      minutes +
      ":" +
      seconds
  );

  const workbook = new excel.Workbook();

  const style = workbook.createStyle({
    font: { color: "#0101FF", size: 11 },
  });

  const worksheet = workbook.addWorksheet("Sheet 1");

  // First line is the header
  worksheet.cell(1, 1).string("Token:").style(style);
  worksheet.cell(1, 2).string("Amount in wallet:").style(style);
  worksheet.cell(1, 3).string("Amount in pool:").style(style);
  worksheet.cell(1, 4).string("Amount in fees:").style(style);
  worksheet.cell(1, 5).string("USD value:").style(style);

  worksheet.cell(2, 1).string("BNB").style(style);
  worksheet.cell(3, 1).string("USDT").style(style);
  worksheet.cell(4, 1).string("WBNB").style(style);
  worksheet.cell(5, 1).string("CAKE").style(style);

  worksheet
    .cell(2, 2)
    .string(`${balanceBNB / decimalsQuote}`)
    .style(style);
  worksheet.cell(3, 2).string(`${balanceBaseToken}`).style(style);
  worksheet.cell(4, 2).string(`${balanceQuoteToken}`).style(style);
  worksheet.cell(5, 2).string(`${balanceCakeToken}`).style(style);

  //worksheet.cell(2,2).string(`${balanceBNB/decimalsQuote}`).style(style);
  worksheet.cell(3, 3).string(`${amount0Human}`).style(style);
  worksheet.cell(4, 3).string(`${amount1Human}`).style(style);
  //worksheet.cell(5,3).string(`${balanceCakeToken}`).style(style);

  worksheet.cell(3, 4).string(`${uncollectedFeesAdjusted_0}`).style(style);
  worksheet.cell(4, 4).string(`${uncollectedFeesAdjusted_1}`).style(style);
  worksheet.cell(5, 4).string(`${amountCake}`).style(style);

  const usdValueBNB = currentValueUSD_tmp1;
  const usdValueUSDT = currentValueUSD_tmp2 + amount0USD + feeAmount0USD;
  const usdValueWBNB = currentValueUSD_tmp3 + amount1USD + feeAmount1USD;
  const usdValueCAKE = currentValueUSD_tmp4 + valueCAKEUSD;

  const usdValueAll = usdValueBNB + usdValueUSDT + usdValueWBNB + usdValueCAKE;

  worksheet.cell(2, 5).string(`${usdValueBNB}`).style(style);
  worksheet.cell(3, 5).string(`${usdValueUSDT}`).style(style);
  worksheet.cell(4, 5).string(`${usdValueWBNB}`).style(style);
  worksheet.cell(5, 5).string(`${usdValueCAKE}`).style(style);
  worksheet.cell(6, 6).string(`${usdValueAll}`).style(style);

  workbook.write(
    `output_${year}_${month}_${date}_${hours}_${minutes}_${seconds}_${BOT_VERSION}.xlsx`
  );
}

// Main function that calls all the needed functions!
async function readValue() {
  await readBalanceWallet();

  await readBalancePending();

  await writeOutput();

  await writeOutputExcel();
}
readValue();
