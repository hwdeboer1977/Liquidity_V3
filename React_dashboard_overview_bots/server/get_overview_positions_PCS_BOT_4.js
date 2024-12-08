// Script to get overview of Pancakeswap Bot 1
const { ethers } = require("ethers");
const excel = require("excel4node");
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
const { getPoolImmutables, getPoolState } = require("./helpers");
const ERC20ABI = require("./abis/erc20.json");
const ERC721ABI = require("./abis/erc721.json");
const MASTERCHEFABI = require("./abis/masterchefv3.json");
const aggregatorV3InterfaceABI = require("./abis/pricefeedABI.json");
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
const writeXlsxFile = require("write-excel-file/node");

const artifacts = {
  INonfungiblePositionManager: require("./abis/NonfungiblePositionManager.json"),
};

const smartRouterAbi = require("./abis/pancakeSmartRouter.json");
const factoryAbi = require("./abis/pancakeSwapFactory.json");
const pancakeV3PoolABI = require("./abis/IPancakeV3Pool.json");

require("dotenv").config();
const WALLET_ADDRESS = process.env.WALLET_ADDRESS_PCS_4;
const INFURA_URL_TESTNET = process.env.BASE_ALCHEMY_MAINNET;
const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET); // Base Mainnet

const BOT_VERSION = "PCS_BASE_BOT_4";

const providerBSC = new ethers.providers.JsonRpcProvider(
  "https://bsc-dataseed1.binance.org:443"
);

// Token addresses Base Mainnet
const baseTokenCA = "0x4200000000000000000000000000000000000006"; // WETH
const quoteTokenCA = "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA"; // USDCb
const cakeToken = "0x3055913c90Fcc1A6CE9a358911721eEb942013A1"; // CAKE

// Oracle price feed address voor BTC/BNB price
const addr = "0xB6064eD41d4f67e353768aA239cA86f4F73665a1";
let priceOracleCAKEUSD = 0;

const decimalsBase = 1000000000000000000; // WETH
const decimalsQuote = 1000000; // USDC
const decimalsCake = 1000000000000000000; // CAKE

let fee = 500;
let feeSwap = 100;
let feeCake = 500;

// Pancakeswap addresses:
const poolAddress = "0xe58b73ff901325b8b2056b29712c50237242f520";
const swapRouterAddress = "0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86";
const positionManagerAddress = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364"; // NonfungiblePositionManager
const PancakeV3Factory = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
const masterChefV3 = "0xC6A2Db661D5a5690172d8eB0a7DEA2d3008665A3";
const poolAddressCake = "0x03c33a2fc0d444a5b61e573f9e1a285357a694fc";

// Let op: bij UNI=>WETH en WETH=>UNI moet je dit wel omdraaien voor de juiste approval
const name0 = "Wrapped Ether";
const symbol0 = "WETH";
const decimals0 = 18;
const address0 = baseTokenCA;

const name1 = "USDC";
const symbol1 = "USDC";
const decimals1 = 6;
const address1 = quoteTokenCA;

const chainId = 8453; // Base mainnet
const BaseToken = new Token(chainId, address0, decimals0, symbol0, name0);
const quoteToken = new Token(chainId, address1, decimals1, symbol1, name1);

// Initialize variables
let currentPrice = 0;
var currentPriceETH = 0;
var currentPriceCake = 0;
let sqrtPriceX96 = 0;

var balanceETH = 0;
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

const ABI = ["function balanceOf(address account) view returns (uint256)"];

const contractBaseToken = new ethers.Contract(baseTokenCA, ABI, provider);
const contractQuoteToken = new ethers.Contract(quoteTokenCA, ABI, provider);
const contractCakeToken = new ethers.Contract(cakeToken, ABI, provider);

const swapRouterContract = new ethers.Contract(
  swapRouterAddress,
  smartRouterAbi,
  provider
);

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

// Function to read the balances and convert into USD values
async function readBalanceWallet() {
  async function getOraclePrice() {
    // Price feed oracle
    const priceFeed = new ethers.Contract(
      addr,
      aggregatorV3InterfaceABI,
      providerBSC
    );
    //console.log(priceFeed)
    await priceFeed.latestRoundData().then((roundData) => {
      // Do something with roundData
      //console.log("Latest Round Data", roundData)
      priceOracleCAKEUSD = roundData.answer.toString() / 100000000;
      //console.log("priceOracleCAKEUSD:" + priceOracleCAKEUSD)
      return priceOracleCAKEUSD;
    });
  }
  getOraclePrice();

  // Inlezen balans (alle coins) van de wallet
  const poolData = await getPoolData(poolContract);
  currentPriceETH = currentPrice;
  console.log("current Price ETH/USDC: " + currentPriceETH);

  console.log("current Price CAKE: " + priceOracleCAKEUSD);

  balanceETH = await provider.getBalance(WALLET_ADDRESS);
  console.log("Balance ETH: " + balanceETH / decimalsBase);

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

  //let currentValueUSD_tmp1 = parseInt((balanceETH / decimalsBase) * (1/currentPrice))
  currentValueUSD_tmp1 = Number((balanceETH / decimalsBase) * currentPriceETH);
  currentValueUSD_tmp2 = Number(balanceBaseToken * currentPriceETH);
  currentValueUSD_tmp3 = Number(balanceQuoteToken * 1);
  currentValueUSD_tmp4 = Number(balanceCakeToken * priceOracleCAKEUSD);

  currentValueUSD = (
    currentValueUSD_tmp1 +
    currentValueUSD_tmp2 +
    currentValueUSD_tmp3 +
    currentValueUSD_tmp4
  ).toFixed(2);

  const writeBalances = `Amount ETH:  ${
    balanceETH / decimalsBase
  }, Amount WETH:  ${balanceBaseToken}, Amount USDC:  ${balanceQuoteToken}, Amount Cake: ${balanceCakeToken}  and total USD value: ${currentValueUSD}`;

  // USD values
  currentPrice = (Math.pow(1.0001, tickPrice) * decimalsBase) / decimalsQuote;
}

// Function to read the pending fees in LP
async function readBalancePending() {
  // Read the NFT is (V3 LP is an ERC721 token)
  async function readInfoLPID() {
    let lastNFT = await fs.promises.readFile("NFT_PCS_BASE_BOT_4.txt", "utf8");
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

  valueCAKEUSD = amountCake * priceOracleCAKEUSD;
  console.log("Value of cakes pending: " + valueCAKEUSD);

  var position = await NonfungiblePositionContract.positions(positionId);
  //console.log(position);

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

    feeAmount0USD = uncollectedFeesAdjusted_0 * currentPriceETH;
    feeAmount1USD = uncollectedFeesAdjusted_1 * 1;
  }

  async function readFees(positionId) {
    //var PoolInfo = await getData(positionId);

    console.log(PoolInfo.feeGrowthInside0LastX128);

    var Fees = await getFees(
      PoolInfo.feeGrowthGlobal0X128,
      PoolInfo.feeGrowthGlobal1X128,
      PoolInfo.feeGrowth0Low,
      PoolInfo.feeGrowth0Hi,
      PoolInfo.feeGrowthInside0LastX128,
      PoolInfo.feeGrowth1Low,
      PoolInfo.feeGrowth1Hi,
      PoolInfo.feeGrowthInside1LastX128,
      PoolInfo.liquidity,
      PoolInfo.Decimal0,
      PoolInfo.Decimal1,
      PoolInfo.tickLow,
      PoolInfo.tickHigh,
      PoolInfo.tickCurrent
    );
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
    amount0USD = amount0Human * currentPriceETH;
    amount1USD = amount1Human * 1;

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
  console.log("currentPriceETH: " + currentPriceETH);
  console.log("currentPriceUSDC: " + 1);
  console.log("currentPriceCake: " + priceOracleCAKEUSD);

  console.log("balanceETH: " + balanceETH / decimalsBase);
  console.log("balanceBaseToken: " + balanceBaseToken);
  console.log("balanceQuoteToken: " + balanceQuoteToken);
  console.log("balanceCakeToken: " + balanceCakeToken);

  console.log("USD value ETH in wallet: " + currentValueUSD_tmp1);
  console.log("USD value WETH in wallet: " + currentValueUSD_tmp2);
  console.log("USD value USDC in wallet: " + currentValueUSD_tmp3);
  console.log("USD value CAKE in wallet: " + currentValueUSD_tmp4);
  console.log("USD value all in wallet: " + currentValueUSD);

  console.log("Amount Cake pending: " + amountCake);
  console.log("USD value Cake pending: " + valueCAKEUSD);

  console.log("Amount liquidity WETH: " + amount0Human);
  console.log("Amount liquidity USDC: " + amount1Human);
  console.log("USD value liquidity WETH: " + amount0USD);
  console.log("USD value liquidity USDC: " + amount1USD);

  console.log("Amount fees WETH: " + uncollectedFeesAdjusted_0);
  console.log("Amount fees USDC: " + uncollectedFeesAdjusted_1);
  console.log("USD value fees WETH: " + feeAmount0USD);
  console.log("USD value fees USDC: " + feeAmount1USD);
}

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

  // Eerste regel wordt de header
  worksheet.cell(1, 1).string("Token:").style(style);
  worksheet.cell(1, 2).string("Amount in wallet:").style(style);
  worksheet.cell(1, 3).string("Amount in pool:").style(style);
  worksheet.cell(1, 4).string("Amount in fees:").style(style);
  worksheet.cell(1, 5).string("USD value:").style(style);

  worksheet.cell(2, 1).string("ETH").style(style);
  worksheet.cell(3, 1).string("WETH").style(style);
  worksheet.cell(4, 1).string("USDC").style(style);
  worksheet.cell(5, 1).string("CAKE").style(style);

  worksheet
    .cell(2, 2)
    .string(`${balanceETH / decimalsBase}`)
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

  const usdValueETH = currentValueUSD_tmp1;
  const usdValueWETH = currentValueUSD_tmp2 + amount0USD + feeAmount0USD;
  const usdValueUSDC = currentValueUSD_tmp3 + amount1USD + feeAmount1USD;
  const usdValueCAKE = currentValueUSD_tmp4 + valueCAKEUSD;

  const usdValueAll = usdValueETH + usdValueWETH + usdValueUSDC + usdValueCAKE;

  worksheet.cell(2, 5).string(`${usdValueETH}`).style(style);
  worksheet.cell(3, 5).string(`${usdValueWETH}`).style(style);
  worksheet.cell(4, 5).string(`${usdValueUSDC}`).style(style);
  worksheet.cell(5, 5).string(`${usdValueCAKE}`).style(style);
  worksheet.cell(6, 6).string(`${usdValueAll}`).style(style);

  workbook.write(
    `output_${year}_${month}_${date}_${hours}_${minutes}_${seconds}_${BOT_VERSION}.xlsx`
  );
}

async function readValue() {
  await readBalanceWallet();

  await readBalancePending();

  await writeOutput();

  await writeOutputExcel();
}
readValue();
