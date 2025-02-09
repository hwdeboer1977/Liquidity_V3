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
Summary of my LP Rebalancing Strategy

✅ 1. Introduce a Confirmation Time (Wait Before Rebalancing)
Only rebalance if LP has been out of range for 5+ minutes.
Avoids unnecessary trading due to quick fluctuations.

✅ 2. Use a Buffer Zone (Avoid Frequent Rebalancing)
Don't rebalance as soon as min/max bin is hit.
Use a 5-bin buffer to avoid over-rebalancing.

✅ 3. Adapt to Market Volatility
If volatility is low, keep a wider range.
If volatility is high, rebalance quickly.
*/

// Get position
const DEV_WALLET = new PublicKey(
  "BepvrzsLkmEF2ZwotqEsY8fKbCzQDaB228nPzfSirQDs"
);

// Solana Connection
const mainnetConnection = new Connection(process.env.RPC_URL!, "confirmed");

// DEFINE TOKEN CONFIGURATION OBJECT
const CONFIG = {
  baseToken: {
    ticker: "SOL",
    mintAddress: new PublicKey("So11111111111111111111111111111111111111112"),
    decimals: 9,
  },
  quoteToken: {
    ticker: "FART",
    mintAddress: new PublicKey("9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump"),
    decimals: 6,
  },
};

// SOL vs SPL Tokens: SOL (Solana) is not an SPL token.
// Problem: getAssociatedTokenAddress() only works for SPL tokens (e.g., USDC, FART).
// SOL is not an SPL token, so there is no ATA for SOL.
// Solution: Fetch SOL balance differently.

const TOTAL_RANGE_INTERVAL = 10; // Number of bins on each side of the active bin
const slippageTolerancePercent = 0.5; // 0.5% slippage

// Keep at least 0.1 SOL (~10M lamports) for gas
const SOL_GAS_RESERVE = 0.1; // Minimum SOL to keep for transaction fees

// Get poolAddress USDC/SOL
const poolAddress = new PublicKey(
  "6wJ7W3oHj7ex6MVFp2o26NSof3aey7U8Brs8E371WCXA"
);

const secretKey = bs58.decode(process.env.PRIVATE_KEY!);
const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));

// Ensure `user` is defined correctly
const user = keypair;

// Get buffer bins and waiting period
const BUFFER_BINS = 0; // This means we can go X bin (left or right) out of range (no fees)
const timeOutOfRangeSeconds = 300;

let outOfRangeStartTime = null; // Track when LP went out of range

// With setInterval(monitorLP, 60000) below, monitorLP() will run every 60 seconds
// regardless of whether the previous execution has finished or not. This can cause race conditions where:
// A new monitorLP() execution starts before the previous execution has completed.
// The same LP position gets removed twice.
// The bot gets stuck in a loop, repeatedly detecting LP as missing.
// Fix: Prevent Overlapping Executions Using a Global Flag
// To prevent multiple monitorLP() instances from running at the same time,
// use a global isRunning flag to ensure that the function completes before being executed again.
// Global flag to prevent multiple concurrent executions
// ✅ Global flag to prevent overlapping executions
let isRunning = false;

async function monitorLP() {
  // ✅ Prevent re-entry if another instance is running
  if (isRunning) {
    console.log("⏳ `monitorLP()` is already running. Skipping this cycle.");
    return;
  }

  isRunning = true; // ✅ Lock execution to prevent re-entry
  console.log("🔍 Checking LP Position...");

  try {
    // ✅ Run your normal LP monitoring logic here
    const dlmmPool = await DLMM.create(mainnetConnection, poolAddress);
    const activeBin = await dlmmPool.getActiveBin();
    console.log("✅ Active Bin ID:", activeBin.binId);

    // Fetch user's LP positions
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
      user.publicKey
    );

    if (!userPositions || userPositions.length === 0) {
      console.error("❌ No LP positions found for this wallet.");
      isRunning = false; // ✅ Unlock execution before exiting
      return;
    }

    const userPosition = userPositions[0];
    const binData = userPosition.positionData.positionBinData;

    // Get min/max bin ID
    const currentMinBinId = Math.min(...binData.map((bin) => bin.binId));
    const currentMaxBinId = Math.max(...binData.map((bin) => bin.binId));

    console.log(`🔹 Current LP Range: ${currentMinBinId} - ${currentMaxBinId}`);

    const rebalanceMinBin = currentMinBinId - BUFFER_BINS;
    const rebalanceMaxBin = currentMaxBinId + BUFFER_BINS;

    if (
      activeBin.binId < rebalanceMinBin ||
      activeBin.binId > rebalanceMaxBin
    ) {
      if (outOfRangeStartTime === null) {
        outOfRangeStartTime = Date.now();
        console.log("⚠️ LP out of range! Starting timer...");
      } else {
        const timeOutOfRange = (Date.now() - outOfRangeStartTime) / 1000;
        console.log(
          `⏳ LP has been out of range for ${timeOutOfRange} seconds.`
        );

        if (timeOutOfRange >= timeOutOfRangeSeconds) {
          console.log(
            "⚠️ LP has been out of range for 5+ minutes! Rebalancing now..."
          );

          console.log("⏳ Removing LP...");
          const removeTx = await removeLP(userPosition, dlmmPool);
          await waitForConfirmation(removeTx);

          if (!removeTx) {
            console.error("❌ LP removal failed. Stopping execution.");
            isRunning = false; // ✅ Unlock execution
            return;
          }

          console.log("⏳ Swapping Tokens...");
          const swapTx = await swapTokens();
          await waitForConfirmation(swapTx);

          if (!swapTx) {
            console.error("❌ Token swap failed. Stopping execution.");
            isRunning = false; // ✅ Unlock execution
            return;
          }

          console.log("⏳ Creating New LP...");
          const createLPTx = await createLP();
          await waitForConfirmation(createLPTx);

          if (!createLPTx) {
            console.error("❌ LP creation failed. Stopping execution.");
            isRunning = false; // ✅ Unlock execution
            return;
          }

          console.log("✅ LP Rebalancing Completed!");
          outOfRangeStartTime = null; // Reset timer after rebalancing
        }
      }
    } else {
      console.log("✅ LP is within range.");
      outOfRangeStartTime = null; // Reset timer if LP goes back in range
    }
  } catch (error) {
    console.error("❌ Error in monitorLP():", error);
  } finally {
    isRunning = false; // ✅ Ensure execution lock is released at the end
  }
}

/* 
Rebalance function:
1. Remove the LP position:  removeLP(userPosition, dlmmPool)  ✅
2. Swap tokens to rebalance portfolio ✅
3. Create a new LP position centered around the new active bin ✅
*/

async function removeLP(userPosition, dlmmPool) {
  console.log("❌ Removing LP Position...");

  // ✅ Ensure the position still exists before removing
  if (
    !userPosition ||
    !userPosition.positionData ||
    !userPosition.positionData.positionBinData
  ) {
    console.error(
      "❌ Invalid userPosition data. Position may already be removed."
    );
    return null;
  }

  const binIdsToRemove = userPosition.positionData.positionBinData.map(
    (bin) => bin.binId
  );
  console.log(`🔹 Removing Liquidity from Bins: ${binIdsToRemove}`);

  const removeLiquidityTx = await dlmmPool.removeLiquidity({
    position: userPosition.publicKey,
    user: user.publicKey,
    binIds: binIdsToRemove,
    bps: new BN(10000), // 100% of liquidity in basis points
    shouldClaimAndClose: true, // Claim fees and close the position
  });

  const latestBlockhash = await mainnetConnection.getLatestBlockhash(
    "finalized"
  );
  removeLiquidityTx.recentBlockhash = latestBlockhash.blockhash;
  removeLiquidityTx.feePayer = user.publicKey;
  removeLiquidityTx.sign(user);

  try {
    const txHash = await mainnetConnection.sendRawTransaction(
      removeLiquidityTx.serialize(),
      { skipPreflight: false, preflightCommitment: "finalized" }
    );

    console.log(`✅ Liquidity removed successfully! Tx Hash: ${txHash}`);

    // ✅ Wait for confirmation before proceeding
    const confirmed = await waitForConfirmation(txHash);
    if (!confirmed) {
      console.error("❌ LP removal confirmation failed. Stopping execution.");
      return null;
    }

    console.log("✅ LP removal confirmed. Verifying removal...");

    // ✅ Retry LP Check Every 5 Seconds Until Confirmed Removed
    let retryCount = 0;
    while (retryCount < 10) {
      const updatedPositions = await dlmmPool.getPositionsByUserAndLbPair(
        user.publicKey
      );

      if (!updatedPositions || updatedPositions.userPositions.length === 0) {
        console.log("✅ LP position successfully removed.");

        // ✅ RESET userPositions to prevent unnecessary rebalancing
        userPosition = null;

        return txHash;
      }

      console.warn(
        `⚠️ LP position still detected. Retrying (${retryCount + 1}/10)...`
      );
      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    console.error("❌ LP removal failed after multiple retries.");
    return null;
  } catch (error) {
    console.error("❌ LP removal transaction failed:", error);
    return null;
  }
}

async function swapTokens() {
  console.log("🔄 Checking Token Balance for Rebalancing...");

  // 🔹 Fetch SOL balance
  const solBalanceLamports = await mainnetConnection.getBalance(DEV_WALLET);
  const solBalance = solBalanceLamports / 10 ** CONFIG.baseToken.decimals; // Convert from lamports to SOL
  console.log(`💰 SOL Balance: ${solBalance.toFixed(6)} SOL`);

  // Get balance from SPL token
  const quoteTokenATA = await getAssociatedTokenAddress(
    CONFIG.quoteToken.mintAddress, // Keep as PublicKey
    DEV_WALLET // Ensure this is also a PublicKey
  );
  console.log(`✅ Computed ATA: ${quoteTokenATA.toBase58()}`);

  const quoteTokenAccount = await getAccount(mainnetConnection, quoteTokenATA);
  const quoteTokenBalance =
    Number(quoteTokenAccount.amount) / 10 ** CONFIG.quoteToken.decimals;
  console.log(
    `${CONFIG.quoteToken.ticker} Balance: ${quoteTokenBalance.toFixed(2)} ${
      CONFIG.quoteToken.ticker
    }`
  );

  // Get current price
  // From the Meteora DLMM Pool
  // And from Chainlink Price Feeds

  // Get pool instance
  const dlmmPool = await DLMM.create(mainnetConnection, poolAddress);

  // Get the active bin from DLMM
  const activeBin = await dlmmPool.getActiveBin();

  // Convert the price from the bin format to human-readable
  const solInYPrice = dlmmPool.fromPricePerLamport(Number(activeBin.price));
  console.log(
    `📈 Current Price 1 ${CONFIG.quoteToken.ticker} vs SOL: ${solInYPrice}`
  );

  // Both balances in SOL value
  console.log("solBalance: ", solBalance);

  const quoteTokenBalanceInSol = quoteTokenBalance * Number(solInYPrice);
  console.log(
    `${CONFIG.quoteToken.ticker} in SOL: ${quoteTokenBalanceInSol.toFixed(
      2
    )} SOL`
  );

  // Total Value=USDC Balance+SOL Value in USDC
  const totalValue = solBalance + quoteTokenBalanceInSol;
  console.log(`📈Total SOL Value: ${totalValue} SOL`);

  // Target Allocation (50%)
  const targetAllocation = totalValue / 2;

  let amountToSwap;
  let swapYtoX;

  // 🔄 Check if we need to swap SOL → Quote or Quote → SOL
  if (solBalance > targetAllocation) {
    // Swap SOL → Quote
    const solToSell = solBalance - targetAllocation;
    console.log(`💱 Swapping ${solToSell.toFixed(6)} SOL → Quote`);
    amountToSwap = solToSell;
    swapYtoX = false;
    //await executeSwap(new BN(solToSell * 10 ** 9), true); // Swap SOL → USDC
  } else if (quoteTokenBalanceInSol > targetAllocation) {
    // Swap Quote → SOL
    const quoteToSell = quoteTokenBalanceInSol - targetAllocation;
    const quoteToSellOwnCurrency = quoteToSell / Number(solInYPrice);
    console.log(`💱 Swapping ${quoteToSellOwnCurrency.toFixed(2)} Quote → SOL`);
    amountToSwap = quoteToSellOwnCurrency;
    swapYtoX = true;
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
    (
      amountToSwap *
      (swapYtoX
        ? 10 ** CONFIG.quoteToken.decimals
        : 10 ** CONFIG.baseToken.decimals)
    ).toFixed(0)
  ); // Convert SOL/QUOTE to correct decimals

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

async function createLP() {
  console.log("Adding liquidity...");

  // Create instance from pool
  const dlmmPool = await DLMM.create(mainnetConnection, poolAddress);

  // Get active bin
  const activeBin = await dlmmPool.getActiveBin();
  const currentPrice = dlmmPool.fromPricePerLamport(Number(activeBin.price));

  // Get current price
  console.log("Current price: ", currentPrice);

  // Get fees
  const increasedFee = await getFees(); // 🔥 Fetch latest priority fee
  console.log(`🚀 Applying Priority Fee: ${increasedFee} lamports`);

  // Get balances
  // Fetch SOL balance
  // Get balance from Native SOL token
  const solBalanceLamports = await mainnetConnection.getBalance(DEV_WALLET);
  const solBalance = solBalanceLamports / 10 ** CONFIG.baseToken.decimals; // Convert from lamports to SOL
  console.log(`💰 SOL Balance: ${solBalance.toFixed(6)} SOL`);

  // Get balance from SPL token
  const quoteTokenATA = await getAssociatedTokenAddress(
    CONFIG.quoteToken.mintAddress, // Keep as PublicKey
    DEV_WALLET // Ensure this is also a PublicKey
  );
  console.log(`✅ Computed ATA: ${quoteTokenATA.toBase58()}`);

  const quoteTokenAccount = await getAccount(mainnetConnection, quoteTokenATA);
  const quoteTokenBalance =
    Number(quoteTokenAccount.amount) / 10 ** CONFIG.quoteToken.decimals;
  console.log(
    `${CONFIG.quoteToken.ticker} Balance: ${quoteTokenBalance.toFixed(2)} ${
      CONFIG.quoteToken.ticker
    }`
  );
  const maxSolForLP = solBalance - SOL_GAS_RESERVE;

  // ✅ If `maxSolForLP` is negative or too low, stop execution
  if (maxSolForLP <= 0.01) {
    // Keep a small buffer (0.01 SOL)
    console.error(
      "❌ Not enough SOL to provide liquidity after reserving gas fees."
    );
    return;
  }

  //   Your SOL to provide liquidity
  const amountSolToLiq = new BN(
    (maxSolForLP * 10 ** CONFIG.baseToken.decimals).toFixed(0)
  ); // Convert SOL to lamports

  // Convert `currentPrice` to BN (scaled to 6 decimals for QUOTE precision)
  // Watch out: choose 1 / Number(currentPrice) or Number(currentPrice) correctly!
  const priceInQuotePerSol = 1 / Number(currentPrice); // Assume SOL/QUOTE
  console.log("Price Quote per Sol: ", priceInQuotePerSol);
  const priceBN = new BN(
    (priceInQuotePerSol * 10 ** CONFIG.quoteToken.decimals).toFixed(0)
  );

  // ✅ Convert SOL Amount to USDC using BN operations
  const amountQuoteToLiqBN = amountSolToLiq
    .mul(priceBN)
    .div(new BN(10 ** CONFIG.baseToken.decimals)); // ✅ Scale correctly

  console.log("amountSolToLiq (SOL in lamports):", amountSolToLiq.toString());
  console.log(
    "amountUsdcToLiq (USDC in micro-units):",
    amountQuoteToLiqBN.toString()
  );

  // ✅ Final liquidity amounts: WATCH THE ORDER
  // SELECT X AND Y CORRECTLY
  //   const totalXAmount = amountSolToLiq; // ✅ SOL in lamports
  //   const totalYAmount = amountQuoteToLiqBN; // ✅ USDC in micro-units

  // SELECT X AND Y CORRECTLY
  const totalXAmount = amountQuoteToLiqBN; // ✅ SOL in lamports
  const totalYAmount = amountSolToLiq; // ✅ USDC in micro-units

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

async function waitForConfirmation(txHash: string): Promise<boolean> {
  console.log(`🔍 Waiting for confirmation: ${txHash}...`);

  for (let attempt = 0; attempt < 10; attempt++) {
    const txStatus = await mainnetConnection.getSignatureStatus(txHash, {
      searchTransactionHistory: true,
    });

    if (
      txStatus &&
      txStatus.value &&
      txStatus.value.confirmationStatus === "finalized"
    ) {
      console.log(`✅ Transaction confirmed: ${txHash}`);
      return true; // ✅ Successfully confirmed
    }

    console.log("⏳ Still waiting... Retrying in 3 seconds.");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.error(`❌ Transaction failed or not confirmed: ${txHash}`);
  return false; // ❌ Failed to confirm
}

async function fetchUpdatedLP(positionPublicKey, dlmmPool) {
  try {
    const refreshedPositions = await dlmmPool.getPositionsByUserAndLbPair(
      positionPublicKey
    );

    if (!refreshedPositions || refreshedPositions.length === 0) {
      return null; // ✅ LP position was successfully removed
    }
    return refreshedPositions;
  } catch (error) {
    console.error("❌ LP position no longer exists:", error);
    return null; // ✅ If position is deleted, return null safely
  }
}

// Run monitoring every 60 seconds
//setInterval(monitorLP, 60000);

// Use `setTimeout()` to prevent overlapping executions
async function startMonitoring() {
  await monitorLP(); // Run the monitoring function
  setTimeout(startMonitoring, 60000); // Schedule next run in 60 seconds
}

startMonitoring(); // Start the monitoring loop
