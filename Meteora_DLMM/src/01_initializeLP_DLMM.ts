import {
  Connection,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { StrategyType } from "@meteora-ag/dlmm";
import * as BN from "bn.js";
import * as dotenv from "dotenv";
import bs58 from "bs58";
import DLMM from "@meteora-ag/dlmm";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import * as web3 from "@solana/web3.js";

dotenv.config();

/*
Script to initialize a new LP:
2. Swap tokens to rebalance portfolio ✅
3. Create a new LP position centered around the new active bin ✅
*/

// Get position
const DEV_WALLET = new PublicKey(
  "BepvrzsLkmEF2ZwotqEsY8fKbCzQDaB228nPzfSirQDs"
);

// Solana Connection
const mainnetConnection = new Connection(process.env.RPC_URL!, "confirmed");

// Get token addresses
// Known USDC and SOL Mint Addresses on Solana Mainnet
const USDC_TOKEN = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
const SOL_TOKEN = new PublicKey("So11111111111111111111111111111111111111112");

// Define the LP pool
// SOL/USDC pools:
// Bin step 10: BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y
// Bin step 2: 5BKxfWMbmYBAEWvyPZS9esPducUba9GqyMjtLCfbaqyF
// Bin step 20: BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh

const TOTAL_RANGE_INTERVAL = 2; // Number of bins on each side of the active bin
const slippageTolerancePercent = 0.5; // 0.5% slippage

// Keep at least 0.1 SOL (~10M lamports) for gas
const SOL_GAS_RESERVE = 0.1; // Minimum SOL to keep for transaction fees

// Get poolAddress USDC/SOL
const poolAddress = new PublicKey(
  "BVRbyLjjfSBcoyiYFuxbgKYnWuiFaF9CSXEa5vdSZ9Hh"
);

// Secretkey and keypair
const secretKey = bs58.decode(process.env.PRIVATE_KEY!);
const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

// Ensure `user` is defined correctly
const user = keypair;

// MAIN FUNCTION TO INITIALIZE NEW LP POSITION
async function initializeLP() {
  console.log("🔍 Initializing LP Position...");

  // Call swap function to get correct balances SOL/USDC
  console.log("⏳ Swapping Tokens...");
  const swapTx = await swapTokens();

  // Wait for confirmation!
  await waitForConfirmation(swapTx);

  // Call createLPTx function to create LP position SOL/USDC
  console.log("⏳ Creating New LP...");
  const createLPTx = await createLP();

  // Wait for confirmation!
  await waitForConfirmation(createLPTx);
}

// Swap function to get correct balances SOL/USDC
async function swapTokens() {
  console.log("🔄 Checking Token Balance for Rebalancing...");

  // 🔹 Fetch SOL balance
  const solBalanceLamports = await mainnetConnection.getBalance(DEV_WALLET);
  const solBalance = solBalanceLamports / 10 ** 9; // Convert from lamports to SOL
  console.log(`💰 SOL Balance: ${solBalance.toFixed(6)} SOL`);

  // 🔹 Fetch USDC balance
  const usdcAta = await getAssociatedTokenAddress(USDC_TOKEN, DEV_WALLET);
  const usdcAccount = await getAccount(mainnetConnection, usdcAta);
  const usdcBalance = Number(usdcAccount.amount) / 10 ** 6; // USDC has 6 decimals

  // Get current price
  // From the Meteora DLMM Pool
  // And from Chainlink Price Feeds

  // Get pool instance
  const dlmmPool = await DLMM.create(mainnetConnection, poolAddress);

  // Get the active bin from DLMM
  const activeBin = await dlmmPool.getActiveBin();

  // Convert the price from the bin format to human-readable
  const solUsdcPrice = dlmmPool.fromPricePerLamport(Number(activeBin.price));
  console.log(`📈 Current SOL/USDC Price (Meteora DLMM): ${solUsdcPrice} USDC`);

  // Both balances in USDC
  console.log(`💰 USDC Balance: ${usdcBalance.toFixed(2)} USDC`);
  const usdSol = solBalance * Number(solUsdcPrice);
  console.log(`📈 Current USD Value of SOL: ${usdSol} USDC`);

  // Total Value=USDC Balance+SOL Value in USDC
  const totalValueUsd = usdSol + usdcBalance;
  console.log(`📈Total USD Value: ${totalValueUsd} USDC`);

  // Target Allocation (50%)
  const targetAllocation = totalValueUsd / 2;

  let amountToSwap;
  let swapYtoX;

  // 🔄 Check if we need to swap SOL → USDC or USDC → SOL
  if (usdSol > targetAllocation) {
    // Swap SOL → USDC
    const solToSell = (usdSol - targetAllocation) / Number(solUsdcPrice);
    console.log(`💱 Swapping ${solToSell.toFixed(6)} SOL → USDC`);
    amountToSwap = solToSell;
    swapYtoX = true;
    //await executeSwap(new BN(solToSell * 10 ** 9), true); // Swap SOL → USDC
  } else if (usdcBalance > targetAllocation) {
    // Swap USDC → SOL
    const usdcToSell = usdcBalance - targetAllocation;
    console.log(`💱 Swapping ${usdcToSell.toFixed(2)} USDC → SOL`);
    amountToSwap = usdcToSell;
    swapYtoX = false;
    //await executeSwap(new BN(usdcToSell * 10 ** 6), false); // Swap USDC → SOL
  } else {
    console.log("✅ Portfolio is already balanced.");
  }

  // Check which way we are swapping
  console.log("swapYtoX: ", swapYtoX);

  // Fetch bin array for swap
  const binArrays = await dlmmPool.getBinArrayForSwap(swapYtoX);

  // Get current fees and increase for faster process
  // ✅ Fetch and use the dynamically calculated priority fee
  const increasedFee = await getFees(); // 🔥 Fetch latest priority fee
  console.log(`🚀 Applying Priority Fee: ${increasedFee} lamports`);

  // Step 1: Get initial swap quote WITHOUT slippage
  // ✅ Convert amount to BN
  const inAmount = new BN(
    (amountToSwap * (swapYtoX ? 10 ** 9 : 10 ** 6)).toFixed(0)
  ); // Convert SOL/USDC to correct decimals

  console.log("amountToSwap: ", amountToSwap);
  console.log("inAmount after decimals: ", inAmount);

  // ✅ Get swap quote
  const initialSwapQuote = await dlmmPool.swapQuote(
    inAmount,
    swapYtoX,
    new BN(0),
    binArrays
  );

  // ✅ Ensure swap quote is valid
  if (!initialSwapQuote || !initialSwapQuote.minOutAmount) {
    console.error("❌ Error: Invalid swap quote!");
    return;
  }

  // ✅ Adjust `minOutAmount` based on slippage tolerance
  const slippageBN = initialSwapQuote.minOutAmount
    .mul(new BN(slippageTolerancePercent * 100)) // Convert to basis points
    .div(new BN(10000)); // Convert to percentage format

  const minOutWithSlippage = initialSwapQuote.minOutAmount.sub(slippageBN);

  console.log(
    `📊 Adjusted Min Out Amount with ${slippageTolerancePercent}% slippage:`,
    minOutWithSlippage.toString()
  );

  // ✅ Use adjusted minOutAmount in the swap transaction
  const swapTx = await dlmmPool.swap({
    inToken: swapYtoX ? dlmmPool.tokenX.publicKey : dlmmPool.tokenY.publicKey,
    binArraysPubkey: initialSwapQuote.binArraysPubkey,
    inAmount: inAmount, // ✅ Use BN
    lbPair: dlmmPool.pubkey,
    user: user.publicKey,
    minOutAmount: minOutWithSlippage, // ✅ Use slippage-adjusted value
    outToken: swapYtoX ? dlmmPool.tokenY.publicKey : dlmmPool.tokenX.publicKey,
  });

  // ✅ Add priority fee instruction to transaction
  swapTx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: increasedFee })
  );

  console.log("✅ Swap transaction prepared with priority fee:", swapTx);

  // Manually Set Blockhash
  // ✅ Fetch a fresh blockhash RIGHT BEFORE signing
  const latestBlockhash = await mainnetConnection.getLatestBlockhash(
    "finalized"
  );

  console.log(`🔄 Fresh Blockhash Fetched: ${latestBlockhash.blockhash}`);

  // ✅ Set the fresh blockhash
  swapTx.recentBlockhash = latestBlockhash.blockhash;
  swapTx.feePayer = user.publicKey;

  // Manually sign the transaction
  swapTx.sign(user);

  console.log("✅ Transaction signed, sending to network...");

  try {
    console.log("✅ Sending swap transaction...");
    const swapTxHash = await mainnetConnection.sendRawTransaction(
      swapTx.serialize(),
      { skipPreflight: false, preflightCommitment: "finalized" }
    );

    if (!swapTxHash) {
      console.error("❌ No transaction hash returned! Swap failed.");
      return null;
    }

    console.log(`✅ Swap Submitted! Transaction Hash: ${swapTxHash}`);
    return swapTxHash; // ✅ Return transaction hash
  } catch (error) {
    console.error("❌ Swap transaction failed:", error);
    return null; // ✅ Return null if swap fails
  }
}

// CreateLP function to create new LP position
async function createLP() {
  console.log("Adding liquidity...");

  // Create instance from pool
  const dlmmPool = await DLMM.create(mainnetConnection, poolAddress);

  // Get active bin
  const activeBin = await dlmmPool.getActiveBin();
  const currentPrice = dlmmPool.fromPricePerLamport(Number(activeBin.price));

  // Get current price
  console.log(`📈 Current price: ${currentPrice} USDC/SOL`);

  // Get fees
  const increasedFee = await getFees(); // 🔥 Fetch latest priority fee
  console.log(`🚀 Applying Priority Fee: ${increasedFee} lamports`);

  // Get balances
  // 🔹 Fetch SOL balance
  const solBalanceLamports = await mainnetConnection.getBalance(DEV_WALLET);
  const solBalance = solBalanceLamports / 10 ** 9; // Convert from lamports to SOL
  // ✅ Dynamically adjust FACTOR_LIQ to avoid "Insufficient Lamports"
  const maxSolForLP = solBalance - SOL_GAS_RESERVE;

  // 🔹 Fetch USDC balance
  const usdcAta = await getAssociatedTokenAddress(USDC_TOKEN, DEV_WALLET);
  const usdcAccount = await getAccount(mainnetConnection, usdcAta);
  const usdcBalance = Number(usdcAccount.amount) / 10 ** 6; // USDC has 6 decimals

  console.log(`💰 SOL Balance: ${solBalance.toFixed(6)} SOL`);
  console.log(`💰 SOL Balance for liquidity: ${maxSolForLP.toFixed(6)} SOL`);
  console.log(`💰 USDC Balance: ${usdcBalance.toFixed(2)} USDC`);

  // Your SOL to provide liquidity
  const amountSolToLiq = new BN((maxSolForLP * 10 ** 9).toFixed(0)); // Convert SOL to lamports

  // ✅ Convert `currentPrice` to BN (scaled to 6 decimals for USDC precision)
  const priceBN = new BN((Number(currentPrice) * 10 ** 6).toFixed(0));

  // ✅ Convert SOL Amount to USDC using BN operations
  const amountUsdcToLiqBN = amountSolToLiq.mul(priceBN).div(new BN(10 ** 9)); // ✅ Scale correctly

  console.log("amountSolToLiq (SOL in lamports):", amountSolToLiq.toString());
  console.log(
    "amountUsdcToLiq (USDC in micro-units):",
    amountUsdcToLiqBN.toString()
  );

  // ✅ Final liquidity amounts
  const totalXAmount = amountSolToLiq; // ✅ SOL in lamports
  const totalYAmount = amountUsdcToLiqBN; // ✅ USDC in micro-units

  console.log(
    "✅ Corrected totalXAmount (SOL in lamports):",
    totalXAmount.toString()
  );
  console.log(
    "✅ Corrected totalYAmount (USDC in micro-units):",
    totalYAmount.toString()
  );
  // Set Liquidity Parameters
  // Meteora DLMM uses bins instead of ticks (like Uniswap V3).
  const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
  const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

  // Add Liquidity to the new position
  const strategyType = StrategyType.SpotBalanced; // Balanced liquidity provision

  // Generate a new LP position keypair
  const newPositionKeypair = Keypair.generate();

  try {
    // ✅ Create liquidity transaction
    const addLiquidityTx =
      await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newPositionKeypair.publicKey,
        user: user.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType,
        },
      });
    // ✅ Fetch latest blockhash to avoid expiration issues
    const { blockhash } = await mainnetConnection.getLatestBlockhash(
      "finalized"
    );

    addLiquidityTx.recentBlockhash = blockhash;
    addLiquidityTx.feePayer = user.publicKey;

    // ✅ Manually sign and send transaction
    addLiquidityTx.sign(user, newPositionKeypair);

    console.log("✅ Transaction signed, sending to network...");
    const addLiquidityTxHash = await mainnetConnection.sendRawTransaction(
      addLiquidityTx.serialize(),
      { skipPreflight: false, preflightCommitment: "finalized" }
    );

    console.log(`✅ Liquidity Added! Transaction Hash: ${addLiquidityTxHash}`);

    // ✅ Wait for confirmation before proceeding
    await waitForConfirmation(addLiquidityTxHash);

    return addLiquidityTxHash;
  } catch (error) {
    console.error("❌ LP Creation failed:", error);
    return null; // ✅ Return null if transaction fails
  }
}

// Helper function to determine fees
async function getFees() {
  // Fetch latest blockhash & recent block info
  // ✅ Use `getFeeForMessage` to fetch the latest fee per signature
  const latestBlockhash = await mainnetConnection.getLatestBlockhash(
    "finalized"
  );

  // ✅ Create a dummy transaction to estimate fee
  const messageV0 = new web3.TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: [],
  }).compileToV0Message();

  // ✅ Get fee per signature
  const feeResponse = await mainnetConnection.getFeeForMessage(messageV0);

  if (!feeResponse.value) {
    console.log("❌ Unable to fetch recent fee. Using default.");
    return 5000; // Default to 5000 microLamports if fetch fails
  }

  const recentFee = feeResponse.value;
  console.log(`🔹 Current Priority Fee: ${recentFee} lamports`);

  const increasedFee = recentFee * 2; // Double the priority fee
  console.log(`🚀 Using Priority Fee: ${increasedFee} lamports`);

  return increasedFee;
}

// Helper function to wait for confirmations
async function waitForConfirmation(txHash) {
  if (!txHash) {
    console.error("❌ Transaction hash is undefined. Skipping confirmation.");
    return;
  }

  console.log(`🔍 Waiting for confirmation: ${txHash}...`);

  let confirmed = false;
  while (!confirmed) {
    const txStatus = await mainnetConnection.getTransaction(txHash, {
      commitment: "finalized",
    });

    if (txStatus) {
      console.log(`✅ Transaction Confirmed: https://solscan.io/tx/${txHash}`);
      confirmed = true;
    } else {
      console.log(`⏳ Still waiting... Retrying in 3 seconds.`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

// Run script
initializeLP();
