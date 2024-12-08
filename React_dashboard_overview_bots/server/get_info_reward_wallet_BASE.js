// Script to get all the accrued fees from Pancakeswap on BASE chain
const { ethers } = require("ethers");
const { ChainId } = require("@pancakeswap-libs/sdk");
const { JsonRpcProvider } = require("@ethersproject/providers");
const ERC20ABI = require("./abis/erc20.json");
const JSBI = require("jsbi");
const pancakeV3PoolABI = require("./abis/IPancakeV3Pool.json");

require("dotenv").config();
const WALLET_ADDRESS = process.env.WALLET_ADDRESS_DESTINATION;

const INFURA_URL_TESTNET = process.env.BASE_ALCHEMY_MAINNET;
const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET); // Base Mainnet

// Token addresses BASE Mainnet
const ethTokenCA = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c"; // ETH
const usdcTokenCA = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC
const wethTokenCA = "0x4200000000000000000000000000000000000006"; // WETH
const cakeTokenCA = "0x3055913c90Fcc1A6CE9a358911721eEb942013A1"; // CAKE

// Token addresses BASE Mainnet
const decimalsUsdc = 1000000; // USDC
const decimalsETH = 1000000000000000000; // EETH
const decimalsCake = 1000000000000000000; // Cake
const decimalsWETH = 1000000000000000000; // WETH

// Pancakeswap addresses BASE:
const poolAddressWETHUSDC = "0xb775272e537cc670c65dc852908ad47015244eaf";
const swapRouterAddress = "0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86";
const positionManagerAddress = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364"; // NonfungiblePositionManager
const masterChefV3 = "0xC6A2Db661D5a5690172d8eB0a7DEA2d3008665A3";
const poolAddressCake = "0x03c33a2fc0d444a5b61e573f9e1a285357a694fc";
const chainId = 56; // Binance Smart Chain mainnet

// Initialise variables
let currentPrice = 0;
var currentPriceETH = 0;
var currentPriceUSDC = 1;
var currentPriceCake = 0;
var currentPriceDai = 1;
var currentPriceWETH = 0;
let sqrtPriceX96 = 0;

var balanceETH = 0;
var balanceUSDC = 0;
var balanceWETH = 0;
var balanceCake = 0;
var balanceDai = 0;

var currentValueUSD_ETH = 0;
var currentValueUSD_USDC = 0;
var currentValueUSD_WETH = 0;
var currentValueUSD_CAKE = 0;
var currentValueUSD = 0;

var usdValueAll = 0;
var usdValueETH = 0;
var usdValueUSDC = 0;
var usdValueWETH = 0;
var usdValueCAKE = 0;

const ABI = ["function balanceOf(address account) view returns (uint256)"];

// Set up ethers contracts
const contractWETHToken = new ethers.Contract(wethTokenCA, ABI, provider);
const contractUSDCToken = new ethers.Contract(usdcTokenCA, ABI, provider);
const contractCakeToken = new ethers.Contract(cakeTokenCA, ABI, provider);

// Get pool data
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
  currentPrice = (Math.pow(1.0001, tickPrice) * decimalsETH) / decimalsUsdc;

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

// Create poolcontracts
const poolContractWETHUSDC = new ethers.Contract(
  poolAddressWETHUSDC,
  pancakeV3PoolABI,
  provider
);

const poolContractCake = new ethers.Contract(
  poolAddressCake,
  pancakeV3PoolABI,
  provider
);

// Function to read all balances
async function readBalanceWallet() {
  const poolData = await getPoolData(poolContractWETHUSDC);
  currentPriceETH = currentPrice;
  console.log("current Price ETH: " + currentPriceETH);

  const poolDataCake = await getPoolData(poolContractCake);
  currentPriceCake = currentPrice / currentPriceETH / 100000;
  console.log("current Price CAKE: " + currentPriceCake);

  const balanceInWeiETH = await provider.getBalance(WALLET_ADDRESS);
  balanceETH = (balanceInWeiETH / decimalsETH).toFixed(3);
  console.log("Balance ETH: " + balanceETH);

  const balanceInWei2 = await contractUSDCToken.balanceOf(WALLET_ADDRESS);
  balanceUSDC =
    ethers.utils.formatEther(balanceInWei2) * (decimalsWETH / decimalsUsdc);

  console.log(`Balance USDC: ` + balanceUSDC);

  const balanceInWei3 = await contractWETHToken.balanceOf(WALLET_ADDRESS);
  balanceWETH = (balanceInWei3 / decimalsETH).toFixed(3);
  console.log(`Balance WETH: ` + balanceWETH);

  const balanceInWei4 = await contractCakeToken.balanceOf(WALLET_ADDRESS);
  balanceCake = (balanceInWei4 / decimalsCake).toFixed(0);
  console.log(`Balance Cake: ` + balanceCake);

  // Read current price and sqrtPriceX96
  await getPoolData(poolContractWETHUSDC);

  //let currentValueUSD_tmp1 = parseInt((balanceBNB / decimalsBase) * (1/currentPrice))
  currentValueUSD_ETH = Number(balanceETH * currentPriceETH);
  currentValueUSD_USDC = Number(balanceUSDC * (1 / currentPriceUSDC));
  currentValueUSD_WETH = Number(balanceWETH * currentPriceETH);
  currentValueUSD_CAKE = Number(balanceCake * currentPriceCake);

  currentValueUSD = (
    currentValueUSD_ETH +
    currentValueUSD_USDC +
    currentValueUSD_WETH +
    currentValueUSD_CAKE
  ).toFixed(0);

  const writeBalances = `Amount ETH:  ${
    balanceETH / decimalsETH
  }, Amount USDC:  ${balanceUSDC}, 
     Amount WETH:  ${balanceWETH}, 
     Amount Cake: ${balanceCake}
      and total USD value: ${currentValueUSD}`;

  console.log("Total value in USD: " + currentValueUSD);

  console.log("Total value USD ETH: " + currentValueUSD_ETH.toFixed(0));
  console.log("Total value USD USDC: " + currentValueUSD_USDC.toFixed(0));
  console.log("Total value USD WETH: " + currentValueUSD_WETH.toFixed(0));
  console.log("Total value USD CAKE: " + currentValueUSD_CAKE.toFixed(0));

  // Export values
  usdValueAll = currentValueUSD;
  usdValueETH = currentValueUSD_ETH.toFixed(0);
  usdValueUSDC = currentValueUSD_USDC.toFixed(0);
  usdValueWETH = currentValueUSD_WETH.toFixed(0);
  usdValueCAKE = currentValueUSD_CAKE.toFixed(0);
}

// Function to get USD values
async function readValue() {
  await readBalanceWallet();
}

let exportUsdValueAll = 0;
let exportUsdValueETH = 0;
let exportUsdValueUSDC = 0;
let exportUsdValueWETH = 0;
let exportUsdValueCAKE = 0;

// Define a function to perform the asynchronous operation and update someVariable
async function waitResultRewardsBase(callback) {
  await readValue().then(() => {
    exportUsdValueAll = usdValueAll;
    exportUsdValueETH = usdValueETH;
    exportUsdValueUSDC = usdValueUSDC;
    exportUsdValueWETH = usdValueWETH;
    exportUsdValueCAKE = usdValueCAKE;

    // Update the global variable with the correct value
    //console.log(exportUsdValueAll);
    //console.log(exportUsdValueBNB);
    callback(
      exportUsdValueAll,
      exportUsdValueETH,
      exportUsdValueUSDC,
      exportUsdValueWETH,
      exportUsdValueCAKE
    ); // Call the callback function with someVariable as argument
  });
}

// Export results
module.exports = {
  readValue,
  waitResultRewardsBase,
  exportUsdValueAll,
  exportUsdValueETH,
  exportUsdValueUSDC,
  exportUsdValueWETH,
  exportUsdValueCAKE,
};
