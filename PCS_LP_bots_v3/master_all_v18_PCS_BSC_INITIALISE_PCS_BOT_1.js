// Script to initialise concentrated liquidity V3 position
// This script is for BOT_4, deployed on Pancakeswap and the BASE chain

// Import required modules and dependencies
const { Web3 } = require("web3"); // Web3.js library for interacting with Ethereum-like blockchains
const { ethers } = require("ethers"); // Ethers.js library for interacting with Ethereum-based networks
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
} = require("@pancakeswap-libs/sdk"); // PancakeSwap SDK for interacting with pools and trading
const { JsonRpcProvider } = require("@ethersproject/providers"); // JSON RPC provider for Ethereum
const { getPoolImmutables, getPoolState } = require("./helpers"); // Helper functions for fetching pool details
const ERC20ABI = require("./abis/erc20.json"); // ERC20 ABI for token interactions
const ERC721ABI = require("./abis/erc721.json"); // ERC721 ABI for NFTs
const JSBI = require("jsbi"); // BigInt library for handling large numbers
const aggregatorV3InterfaceABI = require("./abis/pricefeedABI.json"); // ABI for price feed oracles
const {
  NonfungiblePositionManager,
  quoterABI,
} = require("@pancakeswap/v3-sdk"); // PancakeSwap V3 SDK
const {
  INonfungiblePositionManagerABI,
} = require("./abis/NonfungiblePositionManager.json"); // NonfungiblePositionManager ABI
const { TickMath, FullMath, TickList } = require("@pancakeswap/v3-sdk"); // Utility functions for PancakeSwap V3
const { Pool, Position, nearestUsableTick } = require("@pancakeswap/v3-sdk"); // Pool and Position management classes
const fs = require("node:fs"); // Node.js file system module

// Import ABIs for PancakeSwap contracts
const artifacts = {
  INonfungiblePositionManager: require("./abis/NonfungiblePositionManager.json"),
};

// Import additional ABIs for PancakeSwap
const smartRouterAbi = require("./abis/pancakeSmartRouter.json"); // ABI for smart router
const factoryAbi = require("./abis/pancakeSwapFactory.json"); // ABI for factory
const pancakeV3PoolABI = require("./abis/IPancakeV3Pool.json"); // ABI for PancakeSwap V3 pools

// Load environment variables for sensitive data like wallet address and private key
require("dotenv").config();
const WALLET_ADDRESS = process.env.WALLET_ADDRESS_PCS_1; // Wallet address for transactions
const WALLET_SECRET = process.env.WALLET_SECRET_PCS_1; // Private key for signing transactions

// Token addresses on Binance Smart Chain Mainnet
const baseTokenCA = "0x55d398326f99059ff775485246999027b3197955"; // USDT
const quoteTokenCA = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"; // WBNB
const cakeToken = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"; // CAKE token

// Token decimals (used for scaling values)
const decimalsBase = 10 ** 18; // USDT decimals
const decimalsQuote = 10 ** 18; // WBNB decimals

// Oracle price feed address for BTC/BNB price on Binance Smart Chain
const addr = "0xD5c40f5144848Bd4EF08a9605d860e727b991513"; // Oracle address
let priceOracleBNBUSDT = 0; // Variable to store the fetched price

// Variables to track pool and contract settings
let poolAddress = 0; // Current pool address
let poolContract; // Pool contract instance
let fee = 100; // Fee tier for the pool
let feeSwap = 100; // Fee for swaps
let feeCake = 500; // Fee for CAKE pool

// PancakeSwap-specific addresses
const poolAddress1 = "0x36696169c63e42cd08ce11f5deebbcebae652050"; // Address of the USDT/WBNB pool with fee 500
const poolAddress2 = "0x172fcd41e0913e95784454622d1c3724f546f849"; // Address of the USDT/WBNB pool with fee 100
const positionManagerAddress = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364"; // NonfungiblePositionManager address
const PancakeV3Factory = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865"; // Factory address for PancakeSwap V3
const swapRouterAddress = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"; // Swap router address for PancakeSwap
const masterChefV3 = "0x556B9306565093C855AEA9AE92A594704c2Cd59e"; // MasterChef V3 contract address
const poolAddressCake = "0x7f51c8aaa6b0599abd16674e2b17fec7a9f674a1"; // Address of CAKE pool

// Token information for the pool
const name0 = "USDT"; // Token 0 name
const symbol0 = "USDT"; // Token 0 symbol
const decimals0 = 18; // Token 0 decimals
const address0 = baseTokenCA; // Token 0 address

const name1 = "Wrapped BNB"; // Token 1 name
const symbol1 = "WBNB"; // Token 1 symbol
const decimals1 = 18; // Token 1 decimals
const address1 = quoteTokenCA; // Token 1 address

// Define the Binance Smart Chain mainnet chain ID
const chainId = 56;

// Define the base and quote tokens for PancakeSwap V3
const BaseToken = new Token(chainId, address0, decimals0, symbol0, name0); // USDT token
const quoteToken = new Token(chainId, address1, decimals1, symbol1, name1); // WBNB token

// Initialise variables for tracking prices and pool states
const minPriceFactor = 0.9; // Minimum price factor (90% of the current price)
const maxPriceFactor = 1.1; // Maximum price factor (110% of the current price)
let currentPrice = 0; // Current price of the pool
let currentPriceCake = 0; // Current price of CAKE
let minPrice = 0; // Minimum price threshold
let maxPrice = 0; // Maximum price threshold
let sqrtPriceX96 = 0; // Square root of the price scaled to 96 bits

// Gas settings for transactions
const setGasLimit = 3000000; // Maximum gas limit
const setGasHigher = 2; // Multiplier for estimating gas price

// Variables for tracking scenarios and pool status
let scenario = 0; // Dummy scenario identifier
let statusPoolContract = 1; // Status of the pool contract
let nonceNumber = 0; // Nonce for transactions

// Create an Ethereum provider for Binance Smart Chain
const provider = new ethers.providers.JsonRpcProvider(
  "https://bsc-dataseed1.binance.org:443"
);

// Connect wallet to the provider
const wallet = new ethers.Wallet(WALLET_SECRET, provider); // Wallet instance
const connectedWallet = wallet.connect(provider); // Wallet connected to the provider

// Define a minimal ABI for fetching token balances
const ABI = ["function balanceOf(address account) view returns (uint256)"];

// Create contract instances for interacting with tokens
const contractBaseToken = new ethers.Contract(baseTokenCA, ABI, provider); // USDT contract
const contractQuoteToken = new ethers.Contract(quoteTokenCA, ABI, provider); // WBNB contract
const contractCakeToken = new ethers.Contract(cakeToken, ABI, provider); // CAKE contract

// Create a contract instance for the PancakeSwap swap router
const swapRouterContract = new ethers.Contract(
  swapRouterAddress,
  smartRouterAbi,
  provider
);

// Create a contract instance for NonfungiblePositionManager
const NonfungiblePositionContract = new ethers.Contract(
  positionManagerAddress,
  artifacts.INonfungiblePositionManager,
  provider
);

// Create a contract instance for the CAKE pool
const poolContractCake = new ethers.Contract(
  poolAddressCake,
  pancakeV3PoolABI,
  provider
);

// Manage nonce for transactions
let baseNonce = provider.getTransactionCount(WALLET_ADDRESS); // Fetch current nonce
let nonceOffset = 0; // Offset to avoid transaction conflicts

// Function to get the next nonce for transactions
function getNonce() {
  return baseNonce.then((nonce) => nonce + nonceOffset++); // Increment nonce with offset
}
// Function to approve the tokens for swapping and depositing in LP
// Approves the required token amounts for interaction with PancakeSwap contracts
async function approveContract(tokenContract) {
  // Fetch fee data from the provider (EIP-1559 compatible networks)
  let feeData = await provider.getFeeData();

  // Fetch the current gas price from the provider
  const gasPrice = await provider.getGasPrice();
  // Uncomment the line below to log the gas price in Gwei for debugging purposes
  // console.log(ethers.utils.formatUnits(gasPrice, "gwei"));

  // Define a very large approval amount for token allowance (1e36)
  let amountIn = 1e36;
  const approvalAmount = JSBI.BigInt(amountIn).toString(); // Convert the amount to BigInt as required by the approval function

  // Approve tokens for swapping via the PancakeSwap router
  const approvalResponseSwap = await tokenContract
    .connect(connectedWallet) // Connect the wallet to the token contract
    .approve(swapRouterAddress, approvalAmount, {
      // Specify transaction parameters
      maxFeePerGas: feeData.maxFeePerGas * setGasHigher, // Maximum fee per gas
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher, // Priority fee
      gasLimit: setGasLimit, // Gas limit for the transaction
      nonce: getNonce(), // Fetch the next nonce to ensure unique transactions
    });

  // Approve tokens for depositing into liquidity pools via the NonfungiblePositionManager
  const approvalResponseLP = await tokenContract
    .connect(connectedWallet) // Connect the wallet to the token contract
    .approve(positionManagerAddress, approvalAmount, {
      // Specify transaction parameters
      maxFeePerGas: feeData.maxFeePerGas * setGasHigher, // Maximum fee per gas
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher, // Priority fee
      gasLimit: setGasLimit, // Gas limit for the transaction
      nonce: getNonce(), // Fetch the next nonce
    });
}

// Create instances of the token contracts for USDT and WBNB
let tokenContract0 = new ethers.Contract(address0, ERC20ABI, provider); // Token contract for USDT
let tokenContract1 = new ethers.Contract(address1, ERC20ABI, provider); // Token contract for WBNB

// Function to fetch data about a pool contract
// Retrieves details such as tick spacing, fee, liquidity, and slot0 information
async function getPoolData(poolContract) {
  // Fetch multiple pool parameters simultaneously for efficiency
  let [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(), // Tick spacing of the pool (used to determine price granularity)
    poolContract.fee(), // Pool fee (e.g., 0.3% for fee tier 3000)
    poolContract.liquidity(), // Current liquidity in the pool
    poolContract.slot0(), // slot0 contains sqrtPriceX96 and tick information
  ]);

  // Extract the current tick (used for price calculation)
  tickPrice = slot0[1];
  // Extract the square root price in 96-bit format
  sqrtPriceX96 = slot0[0];

  // Calculate the current price of the pool
  currentPrice = (Math.pow(1.0001, tickPrice) * decimalsBase) / decimalsQuote;

  // Log the tick value for debugging purposes
  console.log(tickPrice);

  // Return all relevant pool data in a structured format
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

// Create instances of pool contracts for two different fee tiers
const poolContract1 = new ethers.Contract(
  poolAddress1,
  pancakeV3PoolABI,
  provider
); // Pool contract for fee tier 500
const poolContract2 = new ethers.Contract(
  poolAddress2,
  pancakeV3PoolABI,
  provider
); // Pool contract for fee tier 100

// Initialize variables for tracking price ratios
let ratioPoolOracleInRange = false; // Whether the price is within the expected range
let ratioPoolOracle = 0; // Current price ratio fetched from the oracle

// Utility function for creating delays (used for timing operations)
// Accepts a duration in milliseconds and resolves a promise after the specified time
const timeOutFunction = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Read current prices from Oracle price feed
// In order to check if pool in the DEX is in line with the Oracle's price
async function checkCondition() {
  // Read current price
  await getPoolData(poolContract);

  // Price feed oracle
  const priceFeed = new ethers.Contract(
    addr,
    aggregatorV3InterfaceABI,
    provider
  );
  await priceFeed.latestRoundData().then((roundData) => {
    // Do something with roundData
    console.log("Latest Round Data", roundData);
    priceOracleETHBTC = roundData.answer.toString() / decimalsBase;
  });

  //await setTimeout(5000);
  ratioPoolOracle = currentPrice / priceOracleETHBTC;
  //ratioPoolOracle = 0.95
  console.log("Current price pools:" + currentPrice);
  console.log("Current price Oracle:" + priceOracleETHBTC);
  console.log("Ratio price pool to oracle:" + ratioPoolOracle);
}
// Compare price from Oracle with price at Pancakeswap
async function checkResultCondition() {
  do {
    await checkCondition();
    if ((ratioPoolOracle > 0.97) & (ratioPoolOracle < 1.03)) {
      ratioPoolOracleInRange = true;
      console.log("Ratio price pool and oracle in line == SWAP TOKENS!");
    } else {
      await timeOutFunction(10000); // Even wachten
    }
  } while (ratioPoolOracleInRange == false);
}

// Function to determine which pool has the highest liquidity
// Higher liquidity pools provide lower slippage for trades
async function determinePoolLiq() {
  // Fetch liquidity data for both pools
  const poolData1 = await getPoolData(poolContract1); // Pool 1 data
  const poolData2 = await getPoolData(poolContract2); // Pool 2 data

  // Fetch USDT balance for Pool 1
  const amountUSDT_1 = await contractBaseToken.balanceOf(poolAddress1);
  const USDTinUSD_1 = Number(amountUSDT_1 / decimalsBase) * 1; // Convert balance to USD value
  console.log("USDTinUSD pool 1: " + Number(USDTinUSD_1));

  // Fetch WBNB balance for Pool 1
  const amountWBNB_1 = await contractQuoteToken.balanceOf(poolAddress1);
  const WBNBinUSD_1 = Number(amountWBNB_1 / decimalsBase) * (1 / currentPrice); // Convert WBNB balance to USD using the current price
  console.log("WBNBinUSD pool 1: " + Number(WBNBinUSD_1));

  // Calculate the total liquidity value for Pool 1 in USD
  const totalValueUSD_1 = USDTinUSD_1 + WBNBinUSD_1;
  console.log("Total liquidity pool 1: " + totalValueUSD_1);

  // Fetch USDT balance for Pool 2
  const amountUSDT_2 = await contractBaseToken.balanceOf(poolAddress2);
  const USDTinUSD_2 = Number(amountUSDT_2 / decimalsBase) * 1; // Convert balance to USD value
  console.log("USDTinUSD pool 2: " + Number(USDTinUSD_2));

  // Fetch WBNB balance for Pool 2
  const amountWBNB_2 = await contractQuoteToken.balanceOf(poolAddress2);
  const WBNBinUSD_2 = Number(amountWBNB_2 / decimalsBase) * (1 / currentPrice); // Convert WBNB balance to USD using the current price
  console.log("WBNBinUSD pool 2: " + Number(WBNBinUSD_2));

  // Calculate the total liquidity value for Pool 2 in USD
  const totalValueUSD_2 = USDTinUSD_2 + WBNBinUSD_2;
  console.log("Total liquidity pool 2: " + totalValueUSD_2);

  // Determine which pool has the higher liquidity
  // Assign the pool address of the higher liquidity pool to `poolAddress`
  if (totalValueUSD_1 > totalValueUSD_2) {
    poolAddress = poolAddress1; // Pool 1 has higher liquidity
  } else {
    poolAddress = poolAddress2; // Pool 2 has higher liquidity
  }
  console.log("Pool address with highest liquidity: " + poolAddress);

  // Create a new pool contract instance for the selected pool
  poolContract = new ethers.Contract(poolAddress, pancakeV3PoolABI, provider);

  return poolContract; // Return the contract instance of the selected pool
}

// Function to read the wallet balances for all relevant tokens
async function readBalance() {
  // Fetch the wallet's native BNB balance
  const balanceBNB = await provider.getBalance(WALLET_ADDRESS);
  console.log("Balance BNB: " + balanceBNB / decimalsBase);

  // Fetch the WBNB token balance
  const balanceInWei2 = await contractQuoteToken.balanceOf(WALLET_ADDRESS);
  const balanceQuoteToken =
    ethers.utils.formatEther(balanceInWei2) * (decimalsBase / decimalsQuote);
  console.log(`Balance ${name1}: ` + balanceQuoteToken);

  // Fetch the USDT token balance
  const balanceInWei3 = await contractBaseToken.balanceOf(WALLET_ADDRESS);
  const balanceBaseToken = ethers.utils.formatEther(balanceInWei3);
  console.log(`Balance ${name0}: ` + balanceBaseToken);

  // Fetch the CAKE token balance
  const balanceInWei4 = await contractCakeToken.balanceOf(WALLET_ADDRESS);
  const balanceCakeToken = ethers.utils.formatEther(balanceInWei4);
  console.log(`Balance Cake: ` + balanceCakeToken);

  // Fetch pool data and update the current BNB price
  await getPoolData(poolContract);
  let currentPriceBNB = currentPrice;

  // Fetch CAKE pool data and update the current CAKE price
  await getPoolData(poolContractCake);
  let currentPriceCake = currentPrice;

  // Calculate USD values for all wallet tokens
  let currentValueUSD_tmp1 = Number(
    (balanceBNB / decimalsBase) * (1 / currentPriceBNB)
  ); // USD value of native BNB
  let currentValueUSD_tmp2 = Number(Number(balanceBaseToken * 1)); // USD value of USDT
  let currentValueUSD_tmp3 = Number(balanceQuoteToken * (1 / currentPriceBNB)); // USD value of WBNB
  let currentValueUSD_tmp4 = Number(balanceCakeToken * (1 / currentPriceCake)); // USD value of CAKE

  // Calculate total USD value of all wallet balances
  let currentValueUSD = (
    currentValueUSD_tmp1 +
    currentValueUSD_tmp2 +
    currentValueUSD_tmp3 +
    currentValueUSD_tmp4
  ).toFixed(2);

  // Prepare a string summarizing all wallet balances and their total value in USD
  const writeBalances = `Amount BNB:  ${
    balanceBNB / decimalsBase
  }, Amount USDT:  ${balanceBaseToken}, 
  Amount WBNB:  ${balanceQuoteToken}, Amount Cake: ${balanceCakeToken}  and total USD value: ${currentValueUSD}`;

  // Write the balance summary to a log file
  fs.writeFile("LOG_PCS_BSC_BOT_1.txt", writeBalances, "utf8", (err) => {
    if (err) {
      console.error(err); // Log any errors during file writing
    } else {
      console.log("Balances successfully written to file."); // Confirm success
    }
  });

  // Set the current price of WBNB (in USD terms)
  currentPrice = currentPriceBNB;
  console.log("current price: " + currentPrice);

  // Calculate the USD value of WBNB in the wallet
  const usdValueWBNB = balanceQuoteToken * (1 / currentPrice); // Convert WBNB balance to USD
  console.log(`USD value ${name0}: ` + balanceBaseToken); // Log USD value of USDT
  console.log(`USD value ${name1}: ` + usdValueWBNB); // Log USD value of WBNB

  // Use the Uniswap V3 formula to calculate token amounts (0 and 1) for LP positions
  // Refer to Uniswap V3 documentation for the formula details
  let amountUSDT = 1; // Simulating adding 1 USDT to the liquidity pool
  maxPrice = maxPriceFactor * currentPrice; // Calculate the maximum price threshold
  minPrice = minPriceFactor * currentPrice; // Calculate the minimum price threshold

  // Calculate the liquidity (Lx) and WBNB amount (y) for the given USDT
  const Lx =
    (amountUSDT * Math.sqrt(currentPrice) * Math.sqrt(maxPrice)) /
    (Math.sqrt(maxPrice) - Math.sqrt(currentPrice)); // Liquidity amount based on the price range
  y = Lx * (Math.sqrt(currentPrice) - Math.sqrt(minPrice)); // Amount of WBNB needed to match 1 USDT
  console.log("Quote needed to match 1 USDT in liquidity: " + y);

  // Calculate the current factor (ratio of WBNB to USDT in the wallet)
  let currentFactor = balanceQuoteToken / balanceBaseToken; // WBNB/USDT ratio
  console.log("Current factor for liquidity: " + currentFactor);

  let sellWBNBAmount = 0; // Amount of WBNB to sell (if applicable)
  let sellUSDTAmount = 0; // Amount of USDT to sell (if applicable)

  // Determine whether to sell WBNB or USDT based on the current factor
  // If the current factor > calculated value (y), sell WBNB for USDT
  if (currentFactor > y) {
    scenario = 1; // Scenario 1: Sell WBNB
    sellWBNBAmount = ((1 - y / currentFactor) / 2) * balanceQuoteToken; // Calculate amount of WBNB to sell
  }
  // If the current factor < calculated value (y), sell USDT for WBNB
  else if (currentFactor < y) {
    scenario = 2; // Scenario 2: Sell USDT
    sellUSDTAmount = ((1 - currentFactor / y) / 2) * balanceBaseToken; // Calculate amount of USDT to sell
  }

  // Log the amounts of WBNB or USDT to sell based on the scenario
  console.log("sellWBNBAmount: " + sellWBNBAmount);
  console.log("sellUSDTAmount: " + sellUSDTAmount);

  // Retrieve the pool's immutable data to identify token0 and token1
  const immutables = await getPoolImmutables(poolContract); // Fetch pool immutables
  console.log("immutables token0: " + immutables.token0); // Log token0 address
  console.log("immutables token1: " + immutables.token1); // Log token1 address

  // Log the status of the pool contract
  console.log("statusPoolContract: " + statusPoolContract);

  let inputAmount = 0; // Initialize the input token amount
  let decimals = 0; // Initialize the decimals for the input token

  // Determine the input and output tokens and their amounts based on the scenario
  if (statusPoolContract == 1) {
    if (scenario == 1) {
      tokenInput = immutables.token1; // Input token is WBNB
      tokenOutput = immutables.token0; // Output token is USDT
      inputAmount = sellWBNBAmount; // Amount of WBNB to sell
      decimals = decimals0; // Decimal precision for USDT
    } else if (scenario == 2) {
      tokenInput = immutables.token0; // Input token is USDT
      tokenOutput = immutables.token1; // Output token is WBNB
      inputAmount = sellUSDTAmount; // Amount of USDT to sell
      decimals = decimals1; // Decimal precision for WBNB
    }
  } else if (statusPoolContract == 2) {
    // Reverse token order for a different pool configuration
    if (scenario == 1) {
      tokenInput = immutables.token0; // Input token is USDT
      tokenOutput = immutables.token1; // Output token is WBNB
      inputAmount = sellWBNBAmount; // Amount of WBNB to sell
      decimals = decimals0; // Decimal precision for USDT
    } else if (scenario == 2) {
      tokenInput = immutables.token1; // Input token is WBNB
      tokenOutput = immutables.token0; // Output token is USDT
      inputAmount = sellUSDTAmount; // Amount of USDT to sell
      decimals = decimals1; // Decimal precision for WBNB
    }
  }

  // Convert the input amount to the appropriate decimal precision for the token
  const inputAmountDec = parseFloat(inputAmount).toFixed(decimals); // Formats the input amount based on the token's decimals

  // Convert the formatted decimal amount into a BigNumber format required for Ethereum transactions
  // For example, 0.001 WBNB would be converted to 1,000,000,000,000,000 (in wei for 18 decimals)
  const amountIn = ethers.utils.parseUnits(inputAmountDec, decimals);

  console.log("inputAmount: " + inputAmount); // Log the raw input amount
  console.log("inputAmountDec: " + inputAmountDec); // Log the formatted input amount
  console.log("amountIn: " + amountIn); // Log the converted BigNumber input amount

  // Fetch the current nonce for the wallet to ensure transaction uniqueness
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);

  // **Important:** Account for slippage when calculating the minimum output amount
  const check = await checkResultCondition(); // Perform any pre-checks for the transaction
  let slippagePercentage = 1; // Set the slippage tolerance as a percentage (1% here)
  let slippageFactor = 1 - slippagePercentage / 100; // Calculate the slippage factor (e.g., 99% of expected output)
  console.log("slippageFactor: " + slippageFactor);

  // Initialize the minimum amount of tokens expected to receive after accounting for slippage
  let setAmountOutMinimum = 0;
  if (scenario == 1) {
    // Scenario 1: Selling WBNB for USDT
    setAmountOutMinimum = BigInt(
      parseInt((amountIn / priceOracleETHBTC) * slippageFactor) // Calculate minimum output considering slippage
    );
  } else if (scenario == 2) {
    // Scenario 2: Selling USDT for WBNB
    setAmountOutMinimum = BigInt(
      parseInt(amountIn * priceOracleETHBTC * slippageFactor) // Calculate minimum output considering slippage
    );
  }
  console.log("setAmountOutMinimum: " + setAmountOutMinimum); // Log the calculated minimum output amount

  // Fetch the current nonce again to ensure no conflicts with other transactions
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);

  // Define the transaction parameters for the swap
  const params = {
    tokenIn: tokenInput, // Address of the input token (e.g., WBNB or USDT)
    tokenOut: tokenOutput, // Address of the output token (e.g., USDT or WBNB)
    fee: immutables.fee, // Fee tier of the pool (e.g., 500 for 0.05%)
    recipient: WALLET_ADDRESS, // Address to receive the output tokens
    deadline: Math.floor(Date.now() / 1000) + 60 * 10, // Deadline for the transaction (10 minutes from now)
    amountIn: amountIn, // Amount of input token to be swapped
    amountOutMinimum: setAmountOutMinimum, // Minimum output tokens expected (with slippage considered)
    sqrtPriceLimitX96: 0, // No specific price limit for this transaction
    nonce: getNonce(), // Fetch the next available nonce
  };

  // Fetch gas fee data for the transaction
  let feeData = await provider.getFeeData();

  // Fetch the nonce again to ensure the transaction is unique
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);

  // Perform the swap only if the pool ratio is within the acceptable range
  if (ratioPoolOracleInRange) {
    // Initiate the swap using the router contract
    const transaction = await swapRouterContract
      .connect(connectedWallet) // Connect the wallet to the router contract
      .exactInputSingle(params, {
        maxFeePerGas: feeData.maxFeePerGas * setGasHigher, // Set maximum gas fee
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher, // Set priority gas fee
        gasLimit: setGasLimit, // Set the gas limit for the transaction
      })
      .then((transaction) => {
        console.log(transaction); // Log the transaction details upon success
      });
  }

  // Fetch the nonce again as the transaction may have altered it
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);
}
// Function to add liquidity to the pool
async function addLiquidity() {
  // Fetch and log the wallet's native BNB balance
  const balanceBNB = await provider.getBalance(WALLET_ADDRESS);
  console.log("Balance BNB: " + balanceBNB / decimalsBase);

  // Fetch and log the WBNB balance in the wallet
  const balanceInWei2 = await contractQuoteToken.balanceOf(WALLET_ADDRESS);
  const balanceQuoteToken =
    ethers.utils.formatEther(balanceInWei2) * (decimalsBase / decimalsQuote);
  console.log(`Balance ${name1}: ` + balanceQuoteToken);

  // Fetch and log the USDT balance in the wallet
  const balanceInWei3 = await contractBaseToken.balanceOf(WALLET_ADDRESS);
  const balanceBaseToken = ethers.utils.formatEther(balanceInWei3);
  console.log(`Balance ${name0}: ` + balanceBaseToken);

  // Fetch data from the pool contract and log key details
  const poolData = await getPoolData(poolContract);
  console.log("tickprice: " + tickPrice); // Current tick price
  console.log("sqrtPriceX96: " + sqrtPriceX96); // Current square root price

  // Define a deadline for the transaction (current time + 30 minutes)
  let deadline = Math.floor(Date.now() / 1000 + 1800);
  console.log("currentPrice: " + currentPrice);

  // Calculate the lower and upper ticks based on the price range
  // Lower tick represents the minimum price for the liquidity position
  tickForLowerPrice = parseInt(
    Math.log((currentPrice * minPriceFactor * decimalsQuote) / decimalsBase) /
      Math.log(1.0001)
  );

  // Upper tick represents the maximum price for the liquidity position
  tickForHigherPrice = parseInt(
    Math.log((currentPrice * maxPriceFactor * decimalsQuote) / decimalsBase) /
      Math.log(1.0001)
  );

  // Adjust ticks to the nearest usable values and extend the range slightly
  let tickLower =
    nearestUsableTick(tickForLowerPrice, poolData.tickSpacing) -
    poolData.tickSpacing * 2;
  let tickUpper =
    nearestUsableTick(tickForHigherPrice, poolData.tickSpacing) +
    poolData.tickSpacing * 2;

  console.log("ticklower: " + tickLower); // Log adjusted lower tick
  console.log("tickUpper: " + tickUpper); // Log adjusted upper tick

  // Calculate the minimum and maximum prices for the liquidity position
  minPrice = minPriceFactor * currentPrice;
  maxPrice = maxPriceFactor * currentPrice;

  // Use Uniswap V3 formulas to calculate liquidity (Lx) and corresponding token amounts
  let amountUSDT = 1; // Amount of USDT to simulate
  const Lx =
    (amountUSDT * Math.sqrt(currentPrice) * Math.sqrt(maxPrice)) /
    (Math.sqrt(maxPrice) - Math.sqrt(currentPrice)); // Liquidity calculation
  y = Lx * (Math.sqrt(currentPrice) - Math.sqrt(minPrice)); // Corresponding WBNB amount

  console.log(Lx); // Log calculated liquidity
  console.log(y); // Log required WBNB amount for USDT
  console.log(balanceBaseToken); // Log USDT balance in the wallet

  // Desired token amounts for the liquidity position
  let amount0Desired = BigInt(balanceBaseToken * factorInLP * decimalsBase); // USDT amount
  let amount1Desired = BigInt(
    y * balanceBaseToken * factorInLP * decimalsQuote
  ); // WBNB amount

  console.log("amount0Desired: " + amount0Desired); // Log desired USDT amount
  console.log("amount1Desired: " + amount1Desired); // Log desired WBNB amount

  let amount0Min = 0; // Minimum USDT amount (can be adjusted for slippage tolerance)
  let amount1Min = 0; // Minimum WBNB amount (can be adjusted for slippage tolerance)

  // Define token addresses for the liquidity position
  let token0 = baseTokenCA; // Address of USDT
  let token1 = quoteTokenCA; // Address of WBNB

  // Fetch current gas fee data for the transaction
  let feeData = await provider.getFeeData();

  // Fetch the current gas price for logging purposes
  const gasPrice = await provider.getGasPrice();
  console.log(ethers.utils.formatUnits(gasPrice, "gwei")); // Log gas price in Gwei

  // Define parameters for minting the liquidity position
  const mintParam = {
    token0: token0, // Address of the first token (USDT)
    token1: token1, // Address of the second token (WBNB)
    fee: fee, // Pool fee tier (e.g., 500 for 0.05%)
    tickLower: tickLower, // Lower tick for the price range
    tickUpper: tickUpper, // Upper tick for the price range
    amount0Desired: amount0Desired, // Desired USDT amount
    amount1Desired: amount1Desired, // Desired WBNB amount
    amount0Min: amount0Min, // Minimum USDT amount
    amount1Min: amount1Min, // Minimum WBNB amount
    recipient: WALLET_ADDRESS, // Address to receive the liquidity position (NFT)
    deadline: deadline, // Transaction deadline
  };

  // Save the current price to a file for reference
  const writePrice = `${currentPrice}`;
  fs.writeFile("PRICE_PCS_BSC_BOT1.txt", writePrice, (err) => {
    if (err) {
      console.error(err); // Log error if writing fails
    } else {
      console.log("Price successfully saved."); // Confirm successful file save
    }
  });
  // Create a new wallet instance using the secret key
  const wallet = new ethers.Wallet(WALLET_SECRET);

  // Connect the wallet to the provider (Binance Smart Chain network)
  const connectedWallet = wallet.connect(provider);

  // Call the `mint` method on the NonfungiblePositionManager contract to add liquidity
  let calldata = await NonfungiblePositionContract.connect(
    connectedWallet
  ).mint(mintParam, {
    maxFeePerGas: feeData.maxFeePerGas * setGasHigher, // Set maximum gas fee
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher, // Set priority fee
    gasLimit: setGasLimit, // Set gas limit
    nonce: getNonce(), // Fetch the current transaction nonce
  });

  // Wait for the transaction to be mined and get the receipt
  const receiptLP = await calldata.wait();
  console.log(receiptLP); // Log the transaction receipt for the liquidity position

  // Pancakeswap allows staking LP NFTs for additional rewards in CAKE
  // Function to stake the most recent NFT position
  async function stakeLatestNFT() {
    // Get the total number of NFT positions owned by the wallet
    const numPositions = await NonfungiblePositionContract.balanceOf(
      WALLET_ADDRESS
    );

    // Prepare an array to hold all position IDs
    const calls = [];

    // Retrieve all position IDs for the wallet
    for (let i = 0; i < numPositions; i++) {
      calls.push(
        NonfungiblePositionContract.tokenOfOwnerByIndex(WALLET_ADDRESS, i)
      );
    }

    // Resolve all the promises to get the position IDs
    const positionIds = await Promise.all(calls);
    console.log(positionIds.toString()); // Log all position IDs

    // Get the most recent position ID (last in the list)
    const positionId = calls[numPositions - 1];

    // Create contract instances for interacting with the NFT manager and staking contracts
    const nftContract = new ethers.Contract(
      positionManagerAddress, // Address of the NFT manager contract
      ERC721ABI, // ABI for ERC721 NFTs
      provider
    );

    const nftContract2 = new ethers.Contract(
      masterChefV3, // Address of the staking contract
      ERC721ABI, // ABI for ERC721 NFTs
      provider
    );

    console.log(positionIds.toString()); // Log the position IDs again for confirmation

    // Fetch gas fee data for the transaction
    let feeData = await provider.getFeeData();

    // Approve the staking contract to manage the NFT
    const transaction = await nftContract
      .connect(connectedWallet) // Connect the wallet to the NFT contract
      .approve(masterChefV3, positionId, {
        maxFeePerGas: feeData.maxFeePerGas * setGasHigher, // Set maximum gas fee
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher, // Set priority fee
        gasLimit: setGasLimit, // Set gas limit
        nonce: getNonce(), // Fetch the current nonce
      });

    // Log and save the ID of the most recent NFT
    let lastNFT = positionIds[numPositions - 1].toString();
    console.log("Last NFT: " + lastNFT);
    const content = `${lastNFT}`;

    // Stake the NFT in the MasterChefV3 contract for additional CAKE rewards
    await nftContract
      .connect(connectedWallet) // Connect the wallet to the NFT contract
      ["safeTransferFrom(address,address,uint256)"](
        WALLET_ADDRESS, // From address
        masterChefV3, // To address (staking contract)
        positionId, // NFT token ID to stake
        {
          maxFeePerGas: feeData.maxFeePerGas * setGasHigher, // Set maximum gas fee
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher, // Set priority fee
          gasLimit: setGasLimit, // Set gas limit
          nonce: getNonce(), // Fetch the current nonce
        }
      );

    // Save the last NFT ID to a file for tracking
    fs.writeFile("NFT_PCS_BSC_BOT_1.txt", content, (err) => {
      if (err) {
        console.error(err); // Log an error if file writing fails
      } else {
        console.log("NFT ID successfully saved."); // Confirm successful file save
      }
    });
  }
}
async function initialiseLP() {
  // Step 0: Approve tokens (only first time)
  approveContract(tokenContract0);
  approveContract(tokenContract1);

  // Step 1: Determine the pool with highest liquidity
  await determinePoolLiq();

  // Step 2: read balances from wallet and buy the necessary tokens to create LP
  await readBalance();

  // Step 3: add liquidity
  setTimeout(addLiquidity, 30000);

  // Step 4: stake the NFT LP in Cake Farm
  setTimeout(stakeLatestNFT, 30000);
}

initialiseLP();
