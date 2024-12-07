// Solana Web3.js library imports for interacting with the Solana blockchain
import {
  Keypair,
  Connection,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

// PublicKey class for representing and working with Solana public keys
import { PublicKey } from "@solana/web3.js";

// Anchor framework provider for Solana
import { AnchorProvider } from "@coral-xyz/anchor";

// Solana token program for interacting with SPL tokens
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

// Utility libraries for arithmetic and percentage handling
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import { unpackAccount } from "@solana/spl-token";

// Arbitrary-precision integer library for working with large numbers
import BN from "bn.js";

// Secret key for the wallet (stored in a JSON file)
import secret from "./wallet.json";

// Whirlpools SDK for interacting with Orca Whirlpools
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  swapQuoteByInputToken,
  PriceMath,
  IGNORE_CACHE,
  increaseLiquidityQuoteByInputTokenWithParams,
} from "@orca-so/whirlpools-sdk";

// Decimal.js library for arbitrary-precision decimal arithmetic
import Decimal from "decimal.js";

// Solana RPC endpoint and commitment level for transactions
const RPC_ENDPOINT_URL = "PUT YOUR API HERE"; // Replace with your API URL
const COMMITMENT = "confirmed"; // Commitment level to ensure finality

// Load environment variables from a `.env` file
require("dotenv").config();
// Set a priority rate for Compute Budget Program instructions (micro lamports)
const PRIORITY_RATE = 100; // Micro-lamports
const SEND_AMT = 0.01 * LAMPORTS_PER_SOL; // Amount to send in lamports

// Instruction for setting compute unit price
const PRIORITY_FEE_IX = ComputeBudgetProgram.setComputeUnitPrice({
  microLamports: PRIORITY_RATE,
});

// Variables for tracking and calculations across multiple functions
let currentPrice = 0; // Current SOL/USDC price
let maxPrice = 0; // Maximum price in range
let minPrice = 0; // Minimum price in range
let maxPriceFactor = 1.1; // Factor for maximum price range
let minPriceFactor = 0.9; // Factor for minimum price range
let balanceBaseToken = 0; // Balance of base token (SOL)
let balanceQuoteToken = 0; // Balance of quote token (USDC)
let sellSOLAmount = 0; // Amount of SOL to sell
let sellUSDCAmount = 0; // Amount of USDC to sell
let scenario = 0; // Scenario for determining token swaps
let factorInLP = 0.9; // Factor for liquidity allocation (90%)

// Create WhirlpoolClient
const provider = AnchorProvider.env();
const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
const client = buildWhirlpoolClient(ctx);

const SOL = {
  mint: new PublicKey("So11111111111111111111111111111111111111112"),
  decimals: 9,
};
const USDC = {
  mint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  decimals: 6,
};

// WhirlpoolsConfig account
// devToken ecosystem / Orca Whirlpools
const DEVNET_WHIRLPOOLS_CONFIG = new PublicKey(
  "2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ"
);

// Get USDC/SOL whirlpool
const tick_spacing = 64;
const whirlpool_pubkey = PDAUtil.getWhirlpool(
  ORCA_WHIRLPOOL_PROGRAM_ID,
  DEVNET_WHIRLPOOLS_CONFIG,
  SOL.mint,
  USDC.mint,
  tick_spacing
).publicKey;
async function getBalance() {
  // Step 1: Initialize a connection to the Solana RPC endpoint
  const connection = new Connection(RPC_ENDPOINT_URL, COMMITMENT);

  // Step 2: Load the wallet's private key and create a Keypair
  const keypair = Keypair.fromSecretKey(new Uint8Array(secret));

  // Debugging: Uncomment to log the RPC endpoint and wallet public key
  // console.log("endpoint:", connection.rpcEndpoint);
  // console.log("wallet pubkey:", keypair.publicKey.toBase58());

  // Define token metadata for USDC and SOL
  // This maps mint addresses to token details (name and decimals)
  const token_defs = {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { name: "USDC", decimals: 6 },
    So11111111111111111111111111111111111111112: { name: "SOL", decimals: 9 },
  };

  // Step 3: Fetch the SOL balance of the wallet
  // The balance is in lamports and must be converted to SOL (divide by 1e9)
  const sol_balance = await connection.getBalance(keypair.publicKey);

  // Step 4: Fetch token accounts associated with the wallet
  // Retrieves all token accounts owned by the wallet's public key
  const accounts = await connection.getTokenAccountsByOwner(keypair.publicKey, {
    programId: TOKEN_PROGRAM_ID, // Filter for SPL Token program accounts
  });

  // Debugging: Uncomment to log all token accounts
  // console.log("getTokenAccountsByOwner:", accounts);

  // Step 5: Iterate over the fetched token accounts
  for (let i = 0; i < accounts.value.length; i++) {
    const value = accounts.value[i];

    // Deserialize the token account data
    const parsed_token_account = unpackAccount(value.pubkey, value.account);

    // Identify the token mint and find the corresponding token metadata
    const mint = parsed_token_account.mint;
    const token_def = token_defs[mint.toBase58()];

    // If the token is not in the `token_defs` map, skip processing
    if (token_def === undefined) continue;

    // Extract the token balance (amount is stored as a raw integer value)
    const amount = parsed_token_account.amount;

    // Convert the raw balance to a user-friendly UI format using the token decimals
    const ui_amount = DecimalUtil.fromBN(
      new BN(amount.toString()),
      token_def.decimals
    );

    // Update the balances for SOL and USDC based on the token name
    if (token_def.name == "SOL") {
      balanceBaseToken = sol_balance / 1_000_000_000; // Convert lamports to SOL
    } else if (token_def.name == "USDC") {
      balanceQuoteToken = Number(ui_amount); // Convert BN to number
    }

    // Debugging: Uncomment to log detailed information for each token account
    /*
    console.log(
      "TokenAccount:",
      value.pubkey.toBase58(),
      "\n  mint:",
      mint.toBase58(),
      "\n  name:",
      token_def.name,
      "\n  amount:",
      amount.toString(),
      "\n  ui_amount:",
      ui_amount.toString(),
      "\n  i:",
      i
    );
    */
  }
}
// Function to fetch the current SOL/USDC price from the Whirlpool pool
async function getPrice() {
  // Debugging: Uncomment to log the RPC endpoint and wallet public key
  // console.log("endpoint:", ctx.connection.rpcEndpoint);
  // console.log("wallet pubkey:", ctx.wallet.publicKey.toBase58());

  // Step 1: Fetch the Whirlpool pool using the Whirlpool public key
  const whirlpool = await client.getPool(whirlpool_pubkey);

  // Step 2: Retrieve the current square root price from the pool's data
  const sqrt_price_x64 = whirlpool.getData().sqrtPrice;

  // Step 3: Convert the square root price to a regular price
  // This uses the decimals of SOL and USDC tokens for accurate conversion
  const price = PriceMath.sqrtPriceX64ToPrice(
    sqrt_price_x64,
    SOL.decimals,
    USDC.decimals
  );

  // Debugging: Uncomment to log the square root price and converted price
  // console.log("sqrt_price_x64:", sqrt_price_x64.toString());
  // console.log("price:", price.toFixed(USDC.decimals));

  // Step 4: Update the global `currentPrice` variable with the converted price
  currentPrice = Number(price);

  // Debugging: Uncomment to log the current price type
  // console.log(typeof currentPrice);
}

// Function to calculate the required amounts of SOL and USDC for liquidity
async function calculateAmount() {
  // Define the base amount of USDC for liquidity calculation
  let amountUSDC = 1; // Assume 1 USDC for calculations
  let y = 0; // Placeholder for the calculated SOL amount
  console.log("Current price: " + currentPrice);

  // Step 1: Calculate the upper and lower price bounds for the liquidity range
  maxPrice = maxPriceFactor * currentPrice; // Maximum price in range
  minPrice = minPriceFactor * currentPrice; // Minimum price in range

  // Step 2: Calculate liquidity based on Uniswap's formulas
  // Lx is the amount of liquidity needed at the given price range
  const Lx =
    (amountUSDC * Math.sqrt(currentPrice) * Math.sqrt(maxPrice)) /
    (Math.sqrt(maxPrice) - Math.sqrt(currentPrice));

  // Calculate the amount of SOL needed for 1 USDC in the given price range
  y = Lx * (Math.sqrt(currentPrice) - Math.sqrt(minPrice));
  console.log("Sol needed to match 1 USDC in liquidity: " + y);

  // Step 3: Log the balances of SOL (base token) and USDC (quote token)
  console.log("balanceBaseToken: " + balanceBaseToken);
  console.log("balanceQuoteToken: " + balanceQuoteToken);

  // Step 4: Calculate the current factor for liquidity
  // This is the ratio of USDC to SOL in the wallet
  let currentFactor = balanceQuoteToken / balanceBaseToken;
  console.log("Current factor for liquidity: " + currentFactor);

  // Step 5: Determine the scenario for token adjustments
  // Scenario 1: If the current factor is greater than `y`, sell USDC for SOL
  if (currentFactor > y) {
    sellUSDCAmount = ((1 - y / currentFactor) / 2) * balanceQuoteToken;
    scenario = 1; // Indicates selling USDC
  }
  // Scenario 2: If the current factor is less than `y`, sell SOL for USDC
  else if (currentFactor < y) {
    sellSOLAmount = ((1 - currentFactor / y) / 2) * balanceBaseToken;
    scenario = 2; // Indicates selling SOL
  }

  // Step 6: Log the amounts to sell for each scenario
  console.log("sellSOLAmount: " + sellSOLAmount); // Amount of SOL to sell
  console.log("sellUSDCAmount: " + sellUSDCAmount); // Amount of USDC to sell
}
// Function to execute a token swap based on the calculated scenario
async function executeSwap() {
  // Step 1: Fetch the Whirlpool pool for SOL/USDC
  const whirlpool = await client.getPool(whirlpool_pubkey);

  // Initialize variables for the input amount, token mint, and converted amount
  let amount_in = new Decimal("0"); // Default input amount
  let coinMint; // Mint address of the token being swapped
  let decimalMint; // Token amount converted to the smallest unit (BN)

  // Step 2: Determine the swap scenario and set token parameters
  if (scenario == 1) {
    // Scenario 1: Swap USDC for SOL
    amount_in = new Decimal(sellUSDCAmount); // Amount of USDC to swap
    coinMint = USDC.mint; // USDC mint address
    decimalMint = DecimalUtil.toBN(amount_in, USDC.decimals); // Convert to smallest units
  } else if (scenario == 2) {
    // Scenario 2: Swap SOL for USDC
    amount_in = new Decimal(sellSOLAmount); // Amount of SOL to swap
    coinMint = SOL.mint; // SOL mint address
    decimalMint = DecimalUtil.toBN(amount_in, SOL.decimals); // Convert to smallest units
  }

  // Step 3: Obtain swap estimation (simulate the swap)
  const quote = await swapQuoteByInputToken(
    whirlpool, // Whirlpool pool instance
    coinMint, // Input token mint
    decimalMint, // Input token amount in smallest units
    Percentage.fromFraction(10, 1000), // Acceptable slippage (1%)
    ctx.program.programId, // Program ID of the Whirlpool SDK
    ctx.fetcher, // Fetcher for data retrieval
    IGNORE_CACHE // Flag to ignore cache and fetch fresh data
  );

  // Step 4: Add instructions to prioritize the transaction with a fee
  const estimated_compute_units = 600_000; // Estimated compute units required (~600k CU)
  const additional_fee_in_lamports = 10_000; // Priority fee in lamports (0.00001 SOL)

  // Step 5: Calculate the fee per compute unit in micro lamports
  const extra_factor = 10000; // Factor for fee calculation
  const set_compute_unit_price_ix = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: Math.floor(
      (additional_fee_in_lamports * 10_000 * extra_factor) /
        estimated_compute_units
    ), // Fee per compute unit
  });

  // Step 6: Set the maximum compute units allowed for the transaction
  const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
    units: estimated_compute_units, // Explicitly specify compute units for the transaction
  });

  // Debugging: Uncomment to inspect the instructions
  // console.log(set_compute_unit_price_ix);
  // console.log(set_compute_unit_limit_ix);

  // Step 7: Add priority instructions to the beginning of the transaction
  const tx = await whirlpool.swap(quote); // Create the swap transaction
  tx.prependInstruction({
    instructions: [set_compute_unit_limit_ix, set_compute_unit_price_ix], // Add priority fee instructions
    cleanupInstructions: [], // Cleanup instructions (if any)
    signers: [], // Additional signers (not required here)
  });

  // Step 8: Send the transaction
  const signature = await tx.buildAndExecute(); // Build and execute the transaction
  console.log("signature:", signature); // Log the transaction signature

  // Step 9: Confirm the transaction on the blockchain
  const latest_blockhash = await ctx.connection.getLatestBlockhash(); // Get the latest blockhash
  await ctx.connection.confirmTransaction(
    { signature, ...latest_blockhash }, // Transaction confirmation data
    "confirmed" // Commitment level
  );
}
// Function to add liquidity to the Whirlpool pool
async function addLiquidity() {
  // Step 1: Define the price range for the liquidity position
  const lower_price = new Decimal(Number(minPrice)); // Lower price bound
  const upper_price = new Decimal(Number(maxPrice)); // Upper price bound

  // Log the price range and wallet balances
  console.log("Lower price: " + lower_price);
  console.log("Upper price: " + upper_price);
  console.log("balanceBaseToken:" + balanceBaseToken);
  console.log("balanceQuoteToken:" + balanceQuoteToken);

  // Calculate the amount of USDC to allocate for liquidity
  const amountToLp = balanceQuoteToken * factorInLP; // Use a fraction of the balance
  const usdc_amount = DecimalUtil.toBN(new Decimal(amountToLp), USDC.decimals); // Convert to smallest units

  // Define slippage tolerance for the liquidity addition
  const slippage = Percentage.fromFraction(10, 1000); // 1% slippage

  // Step 2: Fetch the Whirlpool pool data
  const whirlpool = await client.getPool(whirlpool_pubkey);
  const whirlpool_data = whirlpool.getData(); // Retrieve pool-specific data

  // Retrieve token information for the pool
  const token_a = whirlpool.getTokenAInfo(); // Token A (e.g., WSOL)
  const token_b = whirlpool.getTokenBInfo(); // Token B (e.g., USDC)

  // Step 3: Adjust the price range to valid tick indices
  const lower_tick_index = PriceMath.priceToInitializableTickIndex(
    lower_price, // Lower price
    token_a.decimals, // Decimals for token A
    token_b.decimals, // Decimals for token B
    whirlpool_data.tickSpacing // Tick spacing for the pool
  );
  const upper_tick_index = PriceMath.priceToInitializableTickIndex(
    upper_price, // Upper price
    token_a.decimals, // Decimals for token A
    token_b.decimals, // Decimals for token B
    whirlpool_data.tickSpacing // Tick spacing for the pool
  );

  // Log the calculated tick indices and their corresponding prices
  console.log("lower & upper tick_index:", lower_tick_index, upper_tick_index);
  console.log(
    "lower & upper price:",
    PriceMath.tickIndexToPrice(
      lower_tick_index,
      token_a.decimals,
      token_b.decimals
    ).toFixed(token_b.decimals),
    PriceMath.tickIndexToPrice(
      upper_tick_index,
      token_a.decimals,
      token_b.decimals
    ).toFixed(token_b.decimals)
  );

  // Step 4: Estimate the liquidity deposit parameters
  const quote = increaseLiquidityQuoteByInputTokenWithParams({
    tokenMintA: token_a.mint, // Token A mint address
    tokenMintB: token_b.mint, // Token B mint address
    sqrtPrice: whirlpool_data.sqrtPrice, // Current pool square root price
    tickCurrentIndex: whirlpool_data.tickCurrentIndex, // Current tick index
    tickLowerIndex: lower_tick_index, // Lower tick index
    tickUpperIndex: upper_tick_index, // Upper tick index
    inputTokenMint: USDC.mint, // Input token (USDC) mint address
    inputTokenAmount: usdc_amount, // Amount of input token (in smallest units)
    slippageTolerance: slippage, // Slippage tolerance
  });

  // Log the estimated maximum input amounts for WSOL and USDC
  console.log(
    "WSOL max input:",
    DecimalUtil.fromBN(quote.tokenMaxA, token_a.decimals).toFixed(
      token_a.decimals
    )
  );
  console.log(
    "USDC max input:",
    DecimalUtil.fromBN(quote.tokenMaxB, token_b.decimals).toFixed(
      token_b.decimals
    )
  );

  // Step 5: Add priority fee instructions to optimize transaction execution
  const estimated_compute_units = 300_000; // Estimated compute units for the transaction
  const additional_fee_in_lamports = 10_000; // Priority fee in lamports

  const set_compute_unit_price_ix = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: Math.floor(
      (additional_fee_in_lamports * 1_000_000_000) / estimated_compute_units
    ), // Calculate fee per compute unit
  });
  const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
    units: estimated_compute_units, // Specify compute units for the transaction
  });

  // Step 6: Create a transaction to open a new liquidity position
  const open_position_tx = await whirlpool.openPosition(
    lower_tick_index, // Lower tick index
    upper_tick_index, // Upper tick index
    quote // Liquidity parameters
  );

  // Prepend the priority fee instructions to the transaction
  open_position_tx.tx.prependInstruction({
    instructions: [set_compute_unit_limit_ix, set_compute_unit_price_ix],
    cleanupInstructions: [],
    signers: [],
  });

  // Step 7: Send the transaction and log the signature
  const signature = await open_position_tx.tx.buildAndExecute();
  console.log("signature:", signature);
  console.log("position NFT:", open_position_tx.positionMint.toBase58()); // Position NFT

  // Step 8: Confirm the transaction
  const latest_blockhash = await ctx.connection.getLatestBlockhash();
  await ctx.connection.confirmTransaction(
    { signature, ...latest_blockhash },
    "confirmed" // Commitment level
  );
}

// Main function to execute all steps
async function main() {
  await getBalance(); // Fetch wallet balances
  await getPrice(); // Fetch current price from the Whirlpool
  await calculateAmount(); // Calculate liquidity requirements
  await addLiquidity(); // Add liquidity to the pool
}
main();
