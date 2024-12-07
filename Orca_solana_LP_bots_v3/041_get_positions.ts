import { AnchorProvider, BN } from "@coral-xyz/anchor";
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  PriceMath,
  PoolUtil,
  IGNORE_CACHE,
} from "@orca-so/whirlpools-sdk";
import { TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";
import { DecimalUtil } from "@orca-so/common-sdk";

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

  // Get all token accounts
  const token_accounts = (
    await ctx.connection.getTokenAccountsByOwner(ctx.wallet.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    })
  ).value;

  // Get candidate addresses for the position
  const whirlpool_position_candidate_pubkeys = token_accounts
    .map((ta) => {
      const parsed = unpackAccount(ta.pubkey, ta.account);

      // Derive the address of Whirlpool's position from the mint address (whether or not it exists)
      const pda = PDAUtil.getPosition(ctx.program.programId, parsed.mint);

      // Output candidate info
      console.log(
        "TokenAccount:",
        ta.pubkey.toBase58(),
        "\n  mint:",
        parsed.mint.toBase58(),
        "\n  amount:",
        parsed.amount.toString(),
        "\n  pda:",
        pda.publicKey.toBase58()
      );

      // Returns the address of the Whirlpool position only if the number of tokens is 1 (ignores empty token accounts and non-NFTs)
      return new BN(parsed.amount.toString()).eq(new BN(1))
        ? pda.publicKey
        : undefined;
    })
    .filter((pubkey) => pubkey !== undefined);

  // Get data from Whirlpool position addresses
  const whirlpool_position_candidate_datas = await ctx.fetcher.getPositions(
    whirlpool_position_candidate_pubkeys,
    IGNORE_CACHE
  );
  // Leave only addresses with correct data acquisition as position addresses
  const whirlpool_positions = whirlpool_position_candidate_pubkeys.filter(
    (pubkey, i) => whirlpool_position_candidate_datas[i] !== null
  );

  // Output the address of the positions
  whirlpool_positions.map((position_pubkey) =>
    console.log("position:", position_pubkey.toBase58())
  );
}

main();
