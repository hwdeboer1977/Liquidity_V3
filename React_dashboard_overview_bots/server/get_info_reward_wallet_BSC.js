// Script to get all accrued fees from Pancakeswap on BSC chain
const { ethers } = require("ethers");
const { ChainId } = require("@pancakeswap-libs/sdk");
const { JsonRpcProvider } = require("@ethersproject/providers");
const ERC20ABI = require("./abis/erc20.json");
const JSBI = require("jsbi");
const pancakeV3PoolABI = require("./abis/IPancakeV3Pool.json");

require("dotenv").config();
const WALLET_ADDRESS = process.env.WALLET_ADDRESS_DESTINATION;

// Token addresses BSC Mainnet
const btcTokenCA = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c"; // BTCB
const usdtTokenCA = "0x55d398326f99059ff775485246999027b3197955"; // USDT
const wbnbTokenCA = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"; // WBNB
const cakeTokenCA = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"; // CAKE
const daiTokenCA = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3"; // DAI

// Token addresses BASE Mainnet

const decimalsUsdt = 1000000000000000000; // USDT
const decimalsBtc = 1000000000000000000; // BTC
const decimalsCake = 1000000000000000000; // Cake
const decimalsWbnb = 1000000000000000000; // WBNB

// Pancakeswap addresses BSC:
const poolAddressWBNBUSDT = "0x172fcd41e0913e95784454622d1c3724f546f849"; // fee 500
const poolAddressBTCWBNB = "0x6bbc40579ad1bbd243895ca0acb086bb6300d636"; // fee 500
const poolAddressBNBUSDT = "0x36696169c63e42cd08ce11f5deebbcebae652050"; // We need BNB/USDT Pool to determine price of BNB
const poolAddressBTCUSDT = "0x46cf1cf8c69595804ba91dfdd8d6b960c9b0a7c4"; // We need BTC/USDT Pool to determine price of BTC
const poolAddressCake = "0x7f51c8aaa6b0599abd16674e2b17fec7a9f674a1";

const chainId = 56; // Binance Smart Chain mainnet

// Initialise
let currentPrice = 0;
var currentPriceBNB = 0;
var currentPriceUSDT = 1;
var currentPriceCake = 0;
var currentPriceDai = 1;
var currentPriceBTC = 0;
let sqrtPriceX96 = 0;

var balanceBNB = 0;
var balanceUSDT = 0;
var balanceWBNB = 0;
var balanceCake = 0;
var balanceDai = 0;
var balanceBTC = 0;

var currentValueUSD_BNB = 0;
var currentValueUSD_USDT = 0;
var currentValueUSD_WBNB = 0;
var currentValueUSD_CAKE = 0;
var currentValueUSD_DAI = 0;
var currentValueUSD = 0;
var currentValueUSD_BTC = 0;

var usdValueAll = 0;
var usdValueBNB = 0;
var usdValueBTC = 0;
var usdValueWBNB = 0;
var usdValueUSDT = 0;
var usdValueCAKE = 0;
const provider = new ethers.providers.JsonRpcProvider(
  "https://bsc-dataseed1.binance.org:443"
);

const ABI = ["function balanceOf(address account) view returns (uint256)"];

const contractWBNBToken = new ethers.Contract(wbnbTokenCA, ABI, provider);
const contractUSDTToken = new ethers.Contract(usdtTokenCA, ABI, provider);
const contractCakeToken = new ethers.Contract(cakeTokenCA, ABI, provider);
const contractDaiToken = new ethers.Contract(daiTokenCA, ABI, provider);
const contractBTCToken = new ethers.Contract(btcTokenCA, ABI, provider);

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
  currentPrice = (Math.pow(1.0001, tickPrice) * decimalsWbnb) / decimalsUsdt;

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

// Create 2 poolcontracts
const poolContractWBNBUSDT = new ethers.Contract(
  poolAddressWBNBUSDT,
  pancakeV3PoolABI,
  provider
);

const poolContractCake = new ethers.Contract(
  poolAddressCake,
  pancakeV3PoolABI,
  provider
);

const poolContractBTC = new ethers.Contract(
  poolAddressBTCUSDT,
  pancakeV3PoolABI,
  provider
);

// function to read balances
async function readBalanceWallet() {
  // Inlezen balans (alle coins) van de wallet
  const poolData = await getPoolData(poolContractWBNBUSDT);
  currentPriceBNB = currentPrice;
  console.log("current Price BNB: " + currentPriceBNB);

  const poolDataCake = await getPoolData(poolContractCake);
  currentPriceCake = currentPrice;
  console.log("current Price CAKE: " + currentPriceCake);

  const poolDataBTC = await getPoolData(poolContractBTC);
  currentPriceBTC = currentPrice;
  console.log("current Price BTC: " + currentPriceBTC);

  const balanceBNBWei = await provider.getBalance(WALLET_ADDRESS);
  balanceBNB = (balanceBNBWei / decimalsWbnb).toFixed(2);
  console.log("Balance BNB: " + balanceBNB);

  const balanceInWei2 = await contractUSDTToken.balanceOf(WALLET_ADDRESS);
  balanceUSDT = (balanceInWei2 / decimalsUsdt).toFixed(0);

  console.log(`Balance USDT: ` + balanceUSDT);

  const balanceInWei3 = await contractWBNBToken.balanceOf(WALLET_ADDRESS);
  balanceWBNB = (balanceInWei3 / decimalsWbnb).toFixed(2);
  console.log(`Balance WBNB: ` + balanceWBNB);

  const balanceInWei4 = await contractCakeToken.balanceOf(WALLET_ADDRESS);
  balanceCake = (balanceInWei4 / decimalsCake).toFixed(0);
  console.log(`Balance Cake: ` + balanceCake);

  const balanceInWei5 = await contractDaiToken.balanceOf(WALLET_ADDRESS);
  balanceDai = ethers.utils.formatEther(balanceInWei5);
  console.log(`Balance Dai: ` + balanceDai);

  const balanceInWei6 = await contractBTCToken.balanceOf(WALLET_ADDRESS);
  balanceBTC = (balanceInWei6 / decimalsBtc).toFixed(4);

  console.log(`Balance BTC: ` + balanceBTC);

  // Read current price and sqrtPriceX96
  await getPoolData(poolContractWBNBUSDT);

  //let currentValueUSD_tmp1 = parseInt((balanceBNB / decimalsBase) * (1/currentPrice))
  currentValueUSD_BNB = Number(
    (balanceBNB / decimalsWbnb) * (1 / currentPriceBNB)
  );
  currentValueUSD_USDT = Number(balanceUSDT * (1 / currentPriceUSDT));
  currentValueUSD_WBNB = Number(balanceWBNB * (1 / currentPriceBNB));
  currentValueUSD_CAKE = Number(balanceCake * currentPriceCake);
  currentValueUSD_DAI = Number(balanceDai * currentPriceDai);
  currentValueUSD_BTC = Number(balanceBTC * (1 / currentPriceBTC));

  currentValueUSD = (
    currentValueUSD_BNB +
    currentValueUSD_USDT +
    currentValueUSD_WBNB +
    currentValueUSD_CAKE +
    currentValueUSD_DAI +
    currentValueUSD_BTC
  ).toFixed(0);

  const writeBalances = `Amount BNB:  ${
    balanceBNB / decimalsWbnb
  }, Amount USDT:  ${balanceUSDT}, 
     Amount WBNB:  ${balanceWBNB}, 
     Amount Cake: ${balanceCake}, 
     Amount Dai: ${balanceDai}, Amount BTC: ${balanceBTC}  and total USD value: ${currentValueUSD}`;

  console.log("Total value in USD: " + currentValueUSD);

  console.log("Total value USD BNB: " + currentValueUSD_BNB.toFixed(0));
  console.log("Total value USD USDT: " + currentValueUSD_USDT.toFixed(0));
  console.log("Total value USD WBNB: " + currentValueUSD_WBNB.toFixed(0));
  console.log("Total value USD CAKE: " + currentValueUSD_CAKE.toFixed(0));
  console.log("Total value USD BTC: " + currentValueUSD_BTC.toFixed(0));

  // Onderstaande variabelen exporteren
  usdValueAll = currentValueUSD;
  usdValueBNB = currentValueUSD_BNB.toFixed(0);
  usdValueBTC = currentValueUSD_BTC.toFixed(0);
  usdValueWBNB = currentValueUSD_WBNB.toFixed(0);
  usdValueUSDT = currentValueUSD_USDT.toFixed(0);
  usdValueCAKE = currentValueUSD_CAKE.toFixed(0);
}

async function readValue() {
  await readBalanceWallet();
}

let exportUsdValueAll = 0;
let exportUsdValueBNB = 0;
let exportUsdValueBTC = 0;
let exportUsdValueWBNB = 0;
let exportUsdValueUSDT = 0;
let exportUsdValueCAKE = 0;

// Define a function to perform the asynchronous operation and update someVariable
async function waitResultRewards(callback) {
  await readValue().then(() => {
    exportUsdValueAll = usdValueAll;
    exportUsdValueBNB = usdValueBNB;
    exportUsdValueBTC = usdValueBTC;
    exportUsdValueWBNB = usdValueWBNB;
    exportUsdValueUSDT = usdValueUSDT;
    exportUsdValueCAKE = usdValueCAKE;

    // Update the global variable with the correct value
    //console.log(exportUsdValueAll);
    //console.log(exportUsdValueBNB);
    callback(
      exportUsdValueAll,
      exportUsdValueBNB,
      exportUsdValueBTC,
      exportUsdValueWBNB,
      exportUsdValueUSDT,
      exportUsdValueCAKE
    ); // Call the callback function with someVariable as argument
  });
}

// Export results
module.exports = {
  readValue,
  waitResultRewards,
  exportUsdValueAll,
  exportUsdValueBNB,
  exportUsdValueBTC,
  exportUsdValueWBNB,
  exportUsdValueUSDT,
  exportUsdValueCAKE,
};
