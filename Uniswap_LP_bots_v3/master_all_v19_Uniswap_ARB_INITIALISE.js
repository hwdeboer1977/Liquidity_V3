// Uniswap bot to initialise concentrated liquidity v3 positions
// Based on available funds, desired price etc
// It uses Arbitrum mainnet and has the following steps
// Step 1: approve tokens for swapping and sending to LP
// Step 2: swap tokens 0 and 1 in order to get correct numbers for the LP
// Step 3: add liquidity to uniswap LP

// Declarations
// Importing the ethers library for interacting with the Ethereum blockchain
const { ethers } = require("ethers");

// Importing the ABI for the Uniswap V3 pool interface
const {
  abi: IUniswapV3PoolABI,
} = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");

// Importing the ABI for the Uniswap V3 SwapRouter
const {
  abi: SwapRouterABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json");

// Importing helper functions for retrieving pool immutables and state
const { getPoolImmutables, getPoolState } = require("./helpers");

// Importing the ABI for ERC20 tokens
const ERC20ABI = require("./abi.json");

// Importing the JSBI library for handling large integers
const JSBI = require("jsbi");

// Importing the ABI for the Chainlink price feed
const aggregatorV3InterfaceABI = require("./abis/pricefeedABI.json");

// Importing Token and other utilities from the Uniswap SDK core module
const { Token } = require("@uniswap/sdk-core");

// Importing additional Uniswap V3 SDK components
const { Pool, Position, nearestUsableTick } = require("@uniswap/v3-sdk");
const { TickMath, FullMath, TickList } = require("@uniswap/v3-sdk");

// Importing the ABI for the NonfungiblePositionManager contract
const {
  abi: INonfungiblePositionManagerABI,
} = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json");

// Importing utilities for minting and managing positions on Uniswap V3
const { MintOptions, NonfungiblePositionManager } = require("@uniswap/v3-sdk");

// Importing the Percent utility from the Uniswap SDK core
const { Percent } = require("@uniswap/sdk-core");

// Importing the Node.js file system module for file operations
const fs = require("node:fs");

// Token addresses for the Arbitrum Mainnet
const baseTokenCA = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // Address of WETH token
const quoteTokenCA = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Address of USDC token
// Alternative USDC address (commented out for reference)
// const quoteToken = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'; // USDCe

// Token decimals for calculations
const decimalsBase = 1000000000000000000; // WETH has 18 decimals
const decimalsQuote = 1000000; // USDC has 6 decimals

// Uniswap V3 pool and router addresses on the Arbitrum Mainnet
const poolAddress = "0xc6962004f452be9203591991d15f6b388e09e8d0"; // Pool address for WETH/USDC
const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // SwapRouter address
const positionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; // Address of the NonfungiblePositionManager contract

// Oracle address for ETH/USDC price feed (Chainlink)
const addr = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"; // Address of the price feed
let priceOracleETHUSDC = 0; // Variable to store the fetched price
let fee = 3000; // Uniswap pool fee (0.3%)

// Token metadata for WETH
const name0 = "Wrapped Ether";
const symbol0 = "WETH";
const decimals0 = 18;
const address0 = baseTokenCA; // Address of WETH token

// Token metadata for USDC
const name1 = "USDC";
const symbol1 = "USDC";
const decimals1 = 6;
const address1 = quoteTokenCA; // Address of USDC token

// Arbitrum mainnet chain ID
const chainId = 42161;

// Creating Token instances for WETH and USDC
const BaseToken = new Token(chainId, address0, decimals0, symbol0, name0);
const quoteToken = new Token(chainId, address1, decimals1, symbol1, name1);

// Price range for liquidity positions: 90-110% of the current price
const minPriceFactor = 0.9; // Lower bound as 90% of the current price
const maxPriceFactor = 1.1; // Upper bound as 110% of the current price
let currentPrice = 0; // Variable to store the current price
let minPrice = 0; // Minimum price in the range
let maxPrice = 0; // Maximum price in the range
let sqrtPriceX96 = 0; // Square root of the current price in Q96 format
// Share of funds to allocate as liquidity position
// Using less than 100% to account for potential rounding errors and safety
const factorInLP = 0.82; // 82% of the funds will be allocated for the liquidity position

// Gas settings for transactions
const setGasLimit = 3000000; // Maximum gas limit for transactions
const setGasHigher = 1; // Factor to adjust the gas price (e.g., to prioritize transaction speed)

// Scenario indicator to determine which token is in excess for the liquidity position
let scenario = 0; // Default scenario where no token is in excess
let statusPoolContract = 1; // Status flag for the pool contract (active/inactive)

// Tracking the nonce number for transactions
let nonceNumber = 0; // Initial nonce value

// Wallet settings: Load environment variables for secure access to wallet details
require("dotenv").config(); // Load variables from a `.env` file
const INFURA_URL_TESTNET = process.env.ARBITRUM_ALCHEMY_MAINNET2; // Infura/Alchemy endpoint for the Arbitrum network
const WALLET_ADDRESS = process.env.WALLET_ADDRESS2; // Wallet address for sending/receiving transactions
const WALLET_SECRET = process.env.WALLET_SECRET2; // Wallet private key (keep this secure and never expose it publicly)

// Create a provider connected to the Arbitrum network
const provider = new ethers.providers.JsonRpcProvider(INFURA_URL_TESTNET);

// Initialize a wallet instance with the secret key and provider
const wallet = new ethers.Wallet(WALLET_SECRET, provider);

// Connect the wallet to the provider
const connectedWallet = wallet.connect(provider);

// ABI for fetching ERC20 token balance
const ABI = ["function balanceOf(address account) view returns (uint256)"];

// Construct ethers.js contracts for interacting with tokens and Uniswap contracts

// Contract for the base token (WETH)
const contractBaseToken = new ethers.Contract(baseTokenCA, ABI, provider);

// Contract for the quote token (USDC)
const contractQuoteToken = new ethers.Contract(quoteTokenCA, ABI, provider);

// Contract instance for the Uniswap V3 SwapRouter
const swapRouterContract = new ethers.Contract(
  swapRouterAddress,
  SwapRouterABI,
  provider
);

// Contract instance for the Nonfungible Position Manager
const NonfungiblePositionContract = new ethers.Contract(
  positionManagerAddress,
  IUniswapV3PoolABI,
  provider
);

// Fetch the base nonce for the wallet (number of transactions sent)
let baseNonce = provider.getTransactionCount(WALLET_ADDRESS);

// Offset to increment nonce for handling multiple transactions
let nonceOffset = 0;

// Function to track and get the next nonce value
function getNonce() {
  return baseNonce.then((nonce) => nonce + nonceOffset++); // Increment nonce offset after returning
}
/********* STEP 1: APPROVE TOKENS **********/

// Function to approve tokens for swapping and depositing as LP
// Approval is a one-time action that allows a contract to spend tokens on your behalf
async function approveContract(tokenContract) {
  // Fetch current fee data (EIP-1559 style fees)
  let feeData = await provider.getFeeData();

  // Fetch the current gas price as a fallback
  const gasPrice = await provider.getGasPrice();
  //console.log(ethers.utils.formatUnits(gasPrice, "gwei")); // Optional logging to see the gas price in Gwei

  // Amount to approve: a very large number to ensure sufficient allowance
  let amountIn = 1e36; // Equivalent to 1 * 10^36
  const approvalAmount = JSBI.BigInt(amountIn).toString(); // Convert to BigInt as a string for compatibility

  // Approve tokens for the Uniswap SwapRouter
  const approvalResponseSwap = await tokenContract
    .connect(connectedWallet)
    .approve(swapRouterAddress, approvalAmount, {
      maxFeePerGas: feeData.maxFeePerGas * setGasHigher, // Maximum fee for the transaction
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher, // Priority fee for faster inclusion
      gasLimit: setGasLimit, // Limit the gas usage
      nonce: getNonce(), // Use the tracked nonce for this transaction
    });

  // Approve tokens for the Nonfungible Position Manager (LP operations)
  const approvalResponseLP = await tokenContract
    .connect(connectedWallet)
    .approve(positionManagerAddress, approvalAmount, {
      maxFeePerGas: feeData.maxFeePerGas * setGasHigher, // Maximum fee for the transaction
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher, // Priority fee for faster inclusion
      gasLimit: setGasLimit, // Limit the gas usage
      nonce: getNonce(), // Use the tracked nonce for this transaction
    });
}

// Initialize contract instances for the base and quote tokens
let tokenContract0 = new ethers.Contract(address0, ERC20ABI, provider); // WETH token contract
let tokenContract1 = new ethers.Contract(address1, ERC20ABI, provider); // USDC token contract

/********* STEP 2: GET POOL DATA **********/

// Function to retrieve data from the Uniswap V3 pool contract
async function getPoolData(poolContract) {
  // Fetch pool parameters and state in parallel for efficiency
  let [tickSpacing, fee, liquidity, slot0] = await Promise.all([
    poolContract.tickSpacing(), // The minimum tick spacing for this pool
    poolContract.fee(), // The pool fee in basis points (e.g., 3000 = 0.3%)
    poolContract.liquidity(), // Total liquidity in the pool
    poolContract.slot0(), // Contains important pool data, including the current tick and sqrtPriceX96
  ]);

  // Extract current price-related information from the pool's slot0
  tickPrice = slot0[1]; // The current tick (determines price range)
  sqrtPriceX96 = slot0[0]; // Current square root price in Q96 format
  currentPrice = (Math.pow(1.0001, tickPrice) * decimalsBase) / decimalsQuote; // Calculate the current price in human-readable format

  console.log(tickPrice); // Optional: log the current tick for debugging

  // Return an object with all relevant pool data
  return {
    tickSpacing: tickSpacing, // Minimum tick spacing for the pool
    fee: fee, // Pool fee
    liquidity: liquidity, // Pool liquidity
    sqrtPriceX96: slot0[0], // Square root price
    tick: slot0[1], // Current tick
    tickPrice, // Current tick price
    sqrtPriceX96, // Square root price in Q96 format
    currentPrice, // Human-readable price
  };
}

// Initialize the Uniswap V3 pool contract instance
const poolContract = new ethers.Contract(
  poolAddress, // Address of the pool
  IUniswapV3PoolABI, // ABI for interacting with the pool
  provider // Provider to communicate with the blockchain
);

/********* STEP 3: INITIALIZE ORACLE PRICE **********/

// Variables for Oracle price validation
let ratioPoolOracleInRange = false; // Indicates whether the pool price is within the acceptable range of the Oracle price
let ratioPoolOracle = 0; // Variable to store the ratio between pool and Oracle price
// Timer function: Creates a delay for a specified amount of milliseconds
// Useful for implementing a pause between operations
const timeOutFunction = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Function to check the condition by comparing prices from the pool and Oracle price feed
async function checkCondition() {
  // Retrieve the latest pool data
  await getPoolData(poolContract);

  // Initialize the Chainlink price feed contract for fetching the Oracle price
  const priceFeed = new ethers.Contract(
    addr, // Address of the price feed contract
    aggregatorV3InterfaceABI, // ABI for the Chainlink AggregatorV3Interface
    provider // Provider to interact with the blockchain
  );

  // Fetch the latest round data from the Oracle
  await priceFeed.latestRoundData().then((roundData) => {
    console.log("Latest Round Data", roundData); // Log the raw round data for debugging

    // Extract the price from the round data and convert it to a human-readable format
    // Chainlink prices are typically in 8 decimal format, so divide by 10^8
    priceOracleETHUSDC = roundData.answer.toString() / 100000000;
  });

  // Calculate the ratio of the pool price to the Oracle price
  ratioPoolOracle = currentPrice / priceOracleETHUSDC;

  // Log the current pool price, Oracle price, and their ratio for reference
  console.log("Current price pools:" + currentPrice); // Current price from the Uniswap pool
  console.log("Current price Oracle:" + priceOracleETHUSDC); // Current price from the Oracle
  console.log("Ratio price pool to oracle:" + ratioPoolOracle); // Ratio between the two prices
}
/********* STEP 1: CHECK RESULT CONDITION **********/

// Function to monitor the ratio of pool price to Oracle price and check if they align
async function checkResultCondition() {
  do {
    // Fetch the latest pool and Oracle prices
    await checkCondition();

    // Check if the price ratio is within the acceptable range (97% - 103%)
    if ((ratioPoolOracle > 0.97) & (ratioPoolOracle < 1.03)) {
      ratioPoolOracleInRange = true; // Mark as in range
      console.log("Ratio price pool and oracle in line == SWAP TOKENS!"); // Trigger condition met
    } else {
      // If not in range, wait for 10 seconds before rechecking
      await timeOutFunction(10000);
    }
  } while (ratioPoolOracleInRange == false); // Keep looping until condition is met
}

/********* STEP 2: SWAP TOKENS **********/

// Function to read the balance of ETH, base token, and quote token from the wallet
async function readBalance() {
  // Fetch the wallet's ETH balance (used for gas fees)
  const balanceETH = await provider.getBalance(WALLET_ADDRESS);
  console.log("Balance ETH: " + balanceETH / decimalsBase);

  // Fetch the wallet's balance of the quote token (USDC)
  const balanceInWei2 = await contractQuoteToken.balanceOf(WALLET_ADDRESS);
  const balanceQuoteToken =
    ethers.utils.formatEther(balanceInWei2) * (decimalsBase / decimalsQuote);

  console.log(`Balance ${name1}: ` + balanceQuoteToken);

  // Fetch the wallet's balance of the base token (WETH)
  const balanceInWei3 = await contractBaseToken.balanceOf(WALLET_ADDRESS);
  const balanceBaseToken = ethers.utils.formatEther(balanceInWei3);
  console.log(`Balance ${name0}: ` + balanceBaseToken);

  // Fetch the latest pool data to get the current price
  await getPoolData(poolContract);
  let currentPriceETH = currentPrice; // Current pool price of ETH

  // Calculate the USD values of all balances
  let currentValueUSD_tmp1 = Number(
    (balanceETH / decimalsBase) * currentPriceETH
  ); // ETH value in USD
  let currentValueUSD_tmp2 = Number(balanceQuoteToken * 1); // USDC value in USD
  let currentValueUSD_tmp3 = Number(balanceBaseToken * currentPriceETH); // WETH value in USD

  let currentValueUSD = (
    currentValueUSD_tmp1 +
    currentValueUSD_tmp2 +
    currentValueUSD_tmp3
  ).toFixed(2); // Total portfolio value in USD

  // Log the balances and portfolio value to a file
  const writeBalances = `Amount ETH:  ${
    balanceETH / decimalsBase
  }, Amount USDC:  ${balanceQuoteToken}, 
  Amount WETH:  ${balanceBaseToken},  and total USD value: ${currentValueUSD}`;

  fs.writeFile("LOG_Uniswap_ARB_BOT_2.txt", writeBalances, "utf8", (err) => {
    if (err) {
      console.error(err);
    }
  });

  // USD value calculations for WETH and USDC
  currentPrice = currentPriceETH;
  console.log("current price: " + currentPrice);
  const usdValueWETH = balanceBaseToken * currentPrice;
  console.log(`USD value ${name0}: ` + usdValueWETH);
  console.log(`USD value ${name1}: ` + balanceQuoteToken);

  /********* STEP 3: CALCULATE LIQUIDITY REQUIREMENTS **********/

  // Use Uniswap V3 formulas to calculate token amounts for liquidity
  let amountUSDC = 1; // Assume 1 USDC for liquidity calculation
  let currentPriceInv = 1 / currentPrice; // Inverse of the current price
  maxPrice = maxPriceFactor * currentPriceInv; // Maximum price in range
  minPrice = minPriceFactor * currentPriceInv; // Minimum price in range

  // Calculate the liquidity positions using Uniswap V3 formulas
  const Lx =
    (amountUSDC * Math.sqrt(currentPriceInv) * Math.sqrt(maxPrice)) /
    (Math.sqrt(maxPrice) - Math.sqrt(currentPriceInv));
  y = Lx * (Math.sqrt(currentPriceInv) - Math.sqrt(minPrice)); // Base token amount needed
  console.log("Base needed to match 1 USDC in liquidity: " + y);

  /********* STEP 4: DETERMINE SCENARIO **********/

  // Calculate the current factor for liquidity allocation
  let currentFactor = balanceBaseToken / balanceQuoteToken;
  console.log("Current factor for liquidity: " + currentFactor);

  let sellWETHAmount = 0;
  let sellUSDCAmount = 0;

  // Scenario 1: Too little USDC, sell WETH for USDC
  if (currentFactor > y) {
    scenario = 1;
    sellWETHAmount = ((1 - y / currentFactor) / 2) * balanceBaseToken;
  }
  // Scenario 2: Too much USDC, sell USDC for WETH
  else if (currentFactor < y) {
    scenario = 2;
    sellUSDCAmount = ((1 - currentFactor / y) / 2) * balanceQuoteToken;
  }

  console.log("sellWETHAmount: " + sellWETHAmount);
  console.log("sellUSDCAmount: " + sellUSDCAmount);

  /********* STEP 5: VERIFY POOL CONTRACT TOKENS **********/

  // Fetch the pool contract's immutables to determine token ordering
  const immutables = await getPoolImmutables(poolContract);
  console.log("immutables token0: " + immutables.token0);
  console.log("immutables token1: " + immutables.token1);

  // Verify pool contract status
  console.log("statusPoolContract: " + statusPoolContract);

  // Determine input/output tokens and amounts based on the scenario
  let inputAmount = 0;
  let decimals = 0;

  if (statusPoolContract == 1) {
    if (scenario == 1) {
      tokenInput = immutables.token0; // Input token (e.g., WETH)
      tokenOutput = immutables.token1; // Output token (e.g., USDC)
      inputAmount = sellWETHAmount;
      decimals = decimals0;
    } else if (scenario == 2) {
      tokenInput = immutables.token1;
      tokenOutput = immutables.token0;
      inputAmount = sellUSDCAmount;
      decimals = decimals1;
    }
  } else if (statusPoolContract == 2) {
    if (scenario == 1) {
      tokenInput = immutables.token1;
      tokenOutput = immutables.token0;
      inputAmount = sellWETHAmount;
      decimals = decimals0;
    } else if (scenario == 2) {
      tokenInput = immutables.token0;
      tokenOutput = immutables.token1;
      inputAmount = sellUSDCAmount;
      decimals = decimals1;
    }
  }
  // Convert the input amount to the appropriate decimal format for the token
  const inputAmountDec = parseFloat(inputAmount).toFixed(decimals); // Convert to a fixed decimal format

  // Parse the input amount into the smallest units (e.g., wei for ETH)
  const amountIn = ethers.utils.parseUnits(inputAmountDec, decimals);

  console.log("inputAmount: " + inputAmount); // Log the raw input amount
  console.log("inputAmountDec: " + inputAmountDec); // Log the decimal-adjusted amount
  console.log("amountIn: " + amountIn); // Log the parsed amount in token units

  // Fetch the current transaction count (nonce) for the wallet
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);

  // Track slippage to ensure trade efficiency
  // Pools with low liquidity can lead to high slippage, resulting in poor trade execution
  const check = await checkResultCondition(); // Ensure the pool ratio condition is met
  let slippagePercentage = 1; // Set a 1% slippage tolerance
  let slippageFactor = 1 - slippagePercentage / 100; // Calculate the slippage factor
  console.log("slippageFactor: " + slippageFactor);
  console.log("scenario: " + scenario); // Log the current trading scenario (1 or 2)

  // Determine the minimum amount of output tokens based on slippage and scenario
  let setAmountOutMinimum = 0;
  if (scenario == 1) {
    // Scenario 1: Selling WETH for USDC
    setAmountOutMinimum = BigInt(
      parseInt(
        (amountIn * priceOracleETHUSDC * slippageFactor * decimalsQuote) /
          decimalsBase
      )
    );
  } else if (scenario == 2) {
    // Scenario 2: Selling USDC for WETH
    setAmountOutMinimum = BigInt(
      parseInt(
        ((amountIn / priceOracleETHUSDC) * slippageFactor * decimalsBase) /
          decimalsQuote
      )
    );
  }
  console.log("setAmountOutMinimum: " + setAmountOutMinimum);

  // Fetch the current transaction count (nonce) again for tracking
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);

  // Define parameters for the Uniswap exactInputSingle swap function
  const params = {
    tokenIn: tokenInput, // Token being swapped (input token)
    tokenOut: tokenOutput, // Token being received (output token)
    fee: immutables.fee, // Pool fee (e.g., 3000 for 0.3%)
    recipient: WALLET_ADDRESS, // Wallet address to receive the output tokens
    deadline: Math.floor(Date.now() / 1000) + 60 * 10, // Transaction deadline (10 minutes from now)
    amountIn: amountIn, // Amount of input token
    amountOutMinimum: setAmountOutMinimum, // Minimum amount of output token to receive
    sqrtPriceLimitX96: 0, // No specific price limit
    nonce: getNonce(), // Fetch the next nonce
  };

  // Monitor the gas fee data and update nonce before sending the transaction
  let feeData = await provider.getFeeData();
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);

  // Send the swap transaction to the Uniswap SwapRouter contract
  if (ratioPoolOracleInRange) {
    // Ensure the pool price is within the acceptable range before proceeding
    const transaction = await swapRouterContract
      .connect(connectedWallet)
      .exactInputSingle(params, {
        maxFeePerGas: feeData.maxFeePerGas * setGasHigher, // Max gas fee
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher, // Priority fee for faster execution
        gasLimit: setGasLimit, // Limit on gas usage
      })
      .then((transaction) => {
        console.log(transaction); // Log the transaction details for confirmation
      });
  }

  // Fetch the current transaction count (nonce) again for tracking
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);
}
/********* STEP 3: ADD LIQUIDITY **********/

// Function to add liquidity to the Uniswap V3 pool
async function addLiquidity() {
  // Read the balance of ETH in the wallet
  const balanceETH = await provider.getBalance(WALLET_ADDRESS);
  console.log("Balance ETH: " + balanceETH / decimalsBase);

  // Read the balance of the quote token (e.g., USDC) in the wallet
  const balanceInWei2 = await contractQuoteToken.balanceOf(WALLET_ADDRESS);
  const balanceQuoteToken =
    ethers.utils.formatEther(balanceInWei2) * (decimalsBase / decimalsQuote);
  console.log(`Balance ${name1}: ` + balanceQuoteToken);

  // Read the balance of the base token (e.g., WETH) in the wallet
  const balanceInWei3 = await contractBaseToken.balanceOf(WALLET_ADDRESS);
  const balanceBaseToken = ethers.utils.formatEther(balanceInWei3);
  console.log(`Balance ${name0}: ` + balanceBaseToken);

  // Get the current pool data (price, liquidity, etc.)
  const poolData = await getPoolData(poolContract);
  console.log("tickprice: " + tickPrice);
  console.log("sqrtPriceX96: " + sqrtPriceX96);

  // Set a deadline for the liquidity addition transaction (30 minutes from now)
  let deadline = Math.floor(Date.now() / 1000 + 1800);
  console.log("currentPrice: " + currentPrice);

  // Inverse of the current price
  let currentPriceInv = 1 / currentPrice;

  // Calculate the lower and upper ticks for the price range
  tickForLowerPrice = parseInt(
    Math.log((currentPrice * minPriceFactor * decimalsQuote) / decimalsBase) /
      Math.log(1.0001)
  );
  tickForHigherPrice = parseInt(
    Math.log((currentPrice * maxPriceFactor * decimalsQuote) / decimalsBase) /
      Math.log(1.0001)
  );

  // Determine the nearest usable tick values for the lower and upper price limits
  let tickLower =
    nearestUsableTick(tickForLowerPrice, poolData.tickSpacing) -
    poolData.tickSpacing * 2;
  let tickUpper =
    nearestUsableTick(tickForHigherPrice, poolData.tickSpacing) +
    poolData.tickSpacing * 2;

  console.log("tickLower: " + tickLower);
  console.log("tickUpper: " + tickUpper);

  // Calculate the price range based on the current price and the factors defined
  minPrice = minPriceFactor * currentPriceInv;
  maxPrice = maxPriceFactor * currentPriceInv;

  // Calculate the amount of base token (e.g., WETH) and quote token (e.g., USDC) needed for liquidity
  let amountUSDC = 1; // Assume 1 USDC for liquidity calculations
  const Lx =
    (amountUSDC * Math.sqrt(currentPriceInv) * Math.sqrt(maxPrice)) /
    (Math.sqrt(maxPrice) - Math.sqrt(currentPriceInv));
  y = Lx * (Math.sqrt(currentPriceInv) - Math.sqrt(minPrice));

  // Calculate the desired amounts of tokens for liquidity based on the wallet balances
  let amount0DesiredTmp = parseInt(
    balanceBaseToken * factorInLP * decimalsBase
  );
  let amount1DesiredTmp = parseInt(
    (1 / y) * balanceBaseToken * factorInLP * decimalsQuote
  );

  let amount0Desired = BigInt(amount0DesiredTmp);
  let amount1Desired = BigInt(amount1DesiredTmp);

  console.log("amount0Desired: " + amount0Desired);
  console.log("amount1Desired: " + amount1Desired);

  // Set minimum amounts for the liquidity provision
  let amount0Min = 0;
  let amount1Min = 0;

  // Save the current price to a text file for tracking purposes
  const writePrice = `${currentPrice}`;
  fs.writeFile("PRICE_Uniswap_ARB_BOT2.txt", writePrice, (err) => {
    if (err) {
      console.error(err);
    } else {
      // Successfully saved the price
    }
  });

  // Create the Uniswap pool object using the current pool data
  const WETH_UNI_POOL = new Pool(
    quoteToken,
    BaseToken,
    poolData.fee,
    poolData.sqrtPriceX96.toString(),
    poolData.liquidity.toString(),
    poolData.tick
  );

  // Calculate the amount of WETH to supply based on the wallet balance and the liquidity factor
  const amountWETH = balanceBaseToken * factorInLP;
  const amountWei = Math.trunc(amountWETH * decimalsBase);
  console.log("Amount WETH in WEI: " + amountWei);

  // Create the position object for Uniswap liquidity provision
  const position = new Position.fromAmount0({
    pool: WETH_UNI_POOL,
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0: amountWei.toString(),
    useFullPrecision: true,
  });

  // Get the current nonce for the wallet
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);
  console.log("Nonce: " + nonceNumber);

  // Set parameters for the liquidity minting transaction
  const params2 = {
    recipient: WALLET_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + 60 * 10, // Set a 10-minute deadline for the transaction
    slippageTolerance: new Percent(50, 10_000), // Set slippage tolerance to 0.5%
  };

  // Get the calldata and value required for minting the liquidity position
  const { calldata, value } = NonfungiblePositionManager.addCallParameters(
    position,
    params2
  );

  // Fetch gas fee data from the provider
  let feeData = await provider.getFeeData();
  console.log(feeData);

  // Fetch the gas price estimate from the provider
  const gasPrice = await provider.getGasPrice();
  console.log(ethers.utils.formatUnits(gasPrice, "gwei")); // Log the gas price in Gwei

  // Construct the transaction object for the liquidity minting
  const transaction = {
    data: calldata,
    to: positionManagerAddress,
    value: value,
    from: WALLET_ADDRESS,
    maxFeePerGas: feeData.maxFeePerGas * setGasHigher,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * setGasHigher,
    gasLimit: setGasLimit,
    nonce: getNonce(),
  };

  // Get the nonce for the wallet again to ensure it is updated
  nonceNumber = await provider.getTransactionCount(WALLET_ADDRESS);
  console.log("Nonce: " + nonceNumber);

  // Initialize the wallet and send the transaction
  const wallet2 = new ethers.Wallet(WALLET_SECRET, provider);
  const txRes = await wallet2.sendTransaction(transaction);
}

/********* INITIALIZE LIQUIDITY POSITION **********/
// This function calls all the necessary functions to create the liquidity position
async function initialiseLP() {
  // Step 1: Approve tokens for use in Uniswap liquidity provision (first time only)
  approveContract(tokenContract0);
  approveContract(tokenContract1);

  // Step 2: Read balances from the wallet and buy any necessary tokens for liquidity
  await readBalance();

  // Step 3: Add liquidity to the pool
  setTimeout(addLiquidity, 10000); // Delay to ensure liquidity is added after reading balances
  await addLiquidity(); // Add liquidity
}

// Call the function to initialize liquidity
initialiseLP();
