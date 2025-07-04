/********* IMPORTS *********/
const { ethers } = require("ethers");
require("dotenv").config();
const fetch = require("node-fetch");
const fs = require("node:fs");
const JSBI = require("jsbi");
const { BigNumber } = require("ethers");
const ERC20ABI = require("./abi.json");
const { getNonce } = require("./helpers"); // optional

/********* CONFIG *********/
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const WALLET_ADDRESS = process.env.MY_WALLET2;
const positionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";

const provider = new ethers.providers.JsonRpcProvider(
  `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
);

const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const {
  abi: INonfungiblePositionManagerABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json");
const { tickToPrice } = require("@uniswap/v3-sdk");

const NonfungiblePositionContract = new ethers.Contract(
  positionManagerAddress,
  INonfungiblePositionManagerABI,
  provider
);

/********* UTILS *********/
async function getETHPrice() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
  );
  const data = await res.json();
  return data.ethereum.usd;
}

/********* MAIN FUNCTION *********/
async function analyzePosition({
  positionId,
  poolAddress,
  positionManagerAddress,
  baseTokenSymbol,
  quoteTokenSymbol,
  baseTokenDecimals,
  quoteTokenDecimals,
  ethPrice,
}) {
  const poolContract = new ethers.Contract(
    poolAddress,
    IUniswapV3PoolABI,
    provider
  );
  const positionManager = new ethers.Contract(
    positionManagerAddress,
    INonfungiblePositionManagerABI,
    provider
  );

  const position = await positionManager.positions(positionId);
  const token0 = new ethers.Contract(position.token0, ERC20ABI, provider);
  const token1 = new ethers.Contract(position.token1, ERC20ABI, provider);
  const symbol0 = await token0.symbol();
  const symbol1 = await token1.symbol();
  const decimals0 = await token0.decimals();
  const decimals1 = await token1.decimals();

  const slot0 = await poolContract.slot0();
  const tickCurrent = slot0.tick;

  const liquidity = BigNumber.from(position.liquidity);
  const Q128 = BigNumber.from(2).pow(128);
  const tickLow = await poolContract.ticks(position.tickLower);
  const tickHigh = await poolContract.ticks(position.tickUpper);
  const feeGrowthGlobal0 = await poolContract.feeGrowthGlobal0X128();
  const feeGrowthGlobal1 = await poolContract.feeGrowthGlobal1X128();

  const feeGrowthInside0 = feeGrowthGlobal0
    .sub(
      tickCurrent >= position.tickLower
        ? tickLow.feeGrowthOutside0X128
        : feeGrowthGlobal0.sub(tickLow.feeGrowthOutside0X128)
    )
    .sub(
      tickCurrent < position.tickUpper
        ? tickHigh.feeGrowthOutside0X128
        : feeGrowthGlobal0.sub(tickHigh.feeGrowthOutside0X128)
    );
  const feeGrowthInside1 = feeGrowthGlobal1
    .sub(
      tickCurrent >= position.tickLower
        ? tickLow.feeGrowthOutside1X128
        : feeGrowthGlobal1.sub(tickLow.feeGrowthOutside1X128)
    )
    .sub(
      tickCurrent < position.tickUpper
        ? tickHigh.feeGrowthOutside1X128
        : feeGrowthGlobal1.sub(tickHigh.feeGrowthOutside1X128)
    );

  const earned0 = liquidity
    .mul(feeGrowthInside0.sub(position.feeGrowthInside0LastX128))
    .div(Q128);
  const earned1 = liquidity
    .mul(feeGrowthInside1.sub(position.feeGrowthInside1LastX128))
    .div(Q128);

  const earned0Human = parseFloat(ethers.utils.formatUnits(earned0, decimals0));
  const earned1Human = parseFloat(ethers.utils.formatUnits(earned1, decimals1));

  // Normalize base/quote by token symbol
  const isToken0Base = symbol0 === baseTokenSymbol;
  const baseEarned = isToken0Base ? earned0Human : earned1Human;
  const quoteEarned = isToken0Base ? earned1Human : earned0Human;

  const decimalsWETHBig = 10 ** 18; // WETH decimals
  const decimalsESXBig = 10 ** 9; // ESX decimals
  const decimalsUSDCBig = 10 ** 6; // USDC decimals
  let tickPrice;
  let baseUSD;
  let quoteUSD;

  if (baseTokenSymbol === "USDC") {
    tickPrice =
      (Math.pow(1.0001, tickCurrent) * decimalsESXBig) / decimalsUSDCBig;
    baseUSD = 1; // or fetch USDC price dynamically
    quoteUSD = tickPrice;
  } else if (baseTokenSymbol === "WETH") {
    tickPrice =
      (Math.pow(1.0001, tickCurrent) * decimalsWETHBig) / decimalsESXBig;
    // Compute USD values
    baseUSD = ethPrice; // or fetch USDC price dynamically
    quoteUSD = baseUSD / tickPrice;
  }
  console.log("Tickprice: ", tickPrice);

  return {
    pair: `${symbol0}/${symbol1}`,
    tickCurrent,
    currentPrice: tickPrice,
    earnedBase: baseEarned,
    earnedQuote: quoteEarned,
    earnedBaseUSD: baseEarned * baseUSD,
    earnedQuoteUSD: quoteEarned * quoteUSD,
  };
}

/********* RUN REPORTS *********/
async function runReports() {
  const ethPrice = await getETHPrice(); // Needed for WETH valuation
  console.log("ETH/USD:", ethPrice);

  const pools = [
    {
      label: "USDC/ESX",
      positionId: 3460954,
      poolAddress: "0xc1ae30b276474098bab99ee3e47ca7786f29d699",
      baseTokenSymbol: "USDC",
      quoteTokenSymbol: "ESX",
      baseTokenDecimals: 6,
      quoteTokenDecimals: 9,
    },
    {
      label: "WETH/ESX",
      positionId: 3455875,
      poolAddress: "0xc787ff6f332ee11b2c24fd8c112ac155f95b14ab",
      baseTokenSymbol: "WETH",
      quoteTokenSymbol: "ESX",
      baseTokenDecimals: 9,
      quoteTokenDecimals: 18,
    },
  ];

  for (const pool of pools) {
    const report = await analyzePosition({
      ...pool,
      positionManagerAddress,
      ethPrice,
    });
    console.log(`\n🧾 ${pool.label} Report:`, report);
  }
}

runReports();
