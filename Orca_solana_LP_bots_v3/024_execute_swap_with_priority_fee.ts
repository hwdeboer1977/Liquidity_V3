import { PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  swapQuoteByInputToken,
  IGNORE_CACHE,
} from "@orca-so/whirlpools-sdk";
import Decimal from "decimal.js";

require("dotenv").config();

async function main() {
  // Create WhirlpoolClient
  const provider = AnchorProvider.env();
  const ctx = WhirlpoolContext.withProvider(
    provider,
    ORCA_WHIRLPOOL_PROGRAM_ID
  );
  const client = buildWhirlpoolClient(ctx);

  console.log("endpoint:", ctx.connection.rpcEndpoint);
  console.log("wallet pubkey:", ctx.wallet.publicKey.toBase58());

  // Token definition
  // devToken specification
  // https://everlastingsong.github.io/nebula/
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

  // Get devSAMO/devUSDC whirlpool
  // Whirlpools are identified by 5 elements (Program, Config, mint address of the 1st token,
  // mint address of the 2nd token, tick spacing), similar to the 5 column compound primary key in DB
  const tick_spacing = 64;
  const whirlpool_pubkey = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    DEVNET_WHIRLPOOLS_CONFIG,
    SOL.mint,
    USDC.mint,
    tick_spacing
  ).publicKey;
  console.log("whirlpool_key:", whirlpool_pubkey.toBase58());
  const whirlpool = await client.getPool(whirlpool_pubkey);

  // Swap 1 USDC for SOL
  const amount_in = new Decimal("400" /* USDC */);

  // Obtain swap estimation (run simulation)
  const quote = await swapQuoteByInputToken(
    whirlpool,
    // Input token and amount
    USDC.mint,
    DecimalUtil.toBN(amount_in, USDC.decimals),
    // Acceptable slippage (10/1000 = 1%)
    Percentage.fromFraction(10, 1000),
    ctx.program.programId,
    ctx.fetcher,
    IGNORE_CACHE
  );

  // Output the estimation
  console.log(
    "estimatedAmountIn:",
    DecimalUtil.fromBN(quote.estimatedAmountIn, USDC.decimals).toString(),
    "USDC"
  );
  console.log(
    "estimatedAmountOut:",
    DecimalUtil.fromBN(quote.estimatedAmountOut, SOL.decimals).toString(),
    "SOL"
  );
  console.log(
    "otherAmountThreshold:",
    DecimalUtil.fromBN(quote.otherAmountThreshold, SOL.decimals).toString(),
    "SOL"
  );

  // Create instructions to add priority fee
  const estimated_compute_units = 300_000; // ~ 1_400_000 CU
  const additional_fee_in_lamports = 10_000; // 0.00001 SOL

  const set_compute_unit_price_ix = ComputeBudgetProgram.setComputeUnitPrice({
    // Specify how many micro lamports to pay in addition for 1 CU
    microLamports: Math.floor(
      (additional_fee_in_lamports * 100_000_000) / estimated_compute_units
    ),
  });
  const set_compute_unit_limit_ix = ComputeBudgetProgram.setComputeUnitLimit({
    // To determine the Solana network fee at the start of the transaction, explicitly specify CU
    // If not specified, it will be calculated automatically. But it is almost always specified
    // because even if it is estimated to be large, it will not be refunded
    units: estimated_compute_units,
  });

  // Add instructions to the beginning of the transaction
  const tx = await whirlpool.swap(quote);
  tx.prependInstruction({
    instructions: [set_compute_unit_limit_ix, set_compute_unit_price_ix],
    cleanupInstructions: [],
    signers: [],
  });

  // Send the transaction
  const signature = await tx.buildAndExecute();
  console.log("signature:", signature);

  // Wait for the transaction to complete
  const latest_blockhash = await ctx.connection.getLatestBlockhash();
  await ctx.connection.confirmTransaction(
    { signature, ...latest_blockhash },
    "confirmed"
  );
}

main();
