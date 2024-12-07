import { Keypair, Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  AccountLayout,
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { resolveOrCreateATA, ZERO } from "@orca-so/common-sdk";
import secret from "./wallet.json";

const RPC_ENDPOINT_URL = "PUT YOUR API HERE";
const COMMITMENT = "confirmed";

async function main() {
  // Initialize a connection to the RPC and read in private key
  const connection = new Connection(RPC_ENDPOINT_URL, COMMITMENT);
  const keypair = Keypair.fromSecretKey(new Uint8Array(secret));
  console.log("endpoint:", connection.rpcEndpoint);
  console.log("wallet pubkey:", keypair.publicKey.toBase58());

  // USDC
  const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const USDC_DECIMALS = 6;

  // SOL destination addresss
  const dest_pubkey = new PublicKey(
    "Gkn9sNiDPyJM7ZB27WQS1R6vkH8nhRFUtNoTaDqbemvy"
  );

  // Amount to send
  const amount = 1_000_000; // 1 USDC

  // Obtain the associated token account from the source wallet
  const src_token_account = getAssociatedTokenAddressSync(
    USDC,
    keypair.publicKey
  );

  // Obtain the associated token account for the destination wallet.
  const { address: dest_token_account, ...create_ata_ix } =
    await resolveOrCreateATA(
      connection,
      dest_pubkey,
      USDC,
      () => connection.getMinimumBalanceForRentExemption(AccountLayout.span),
      ZERO,
      keypair.publicKey
    );

  // Create the instruction to send devSAMO
  const transfer_ix = createTransferCheckedInstruction(
    src_token_account,
    USDC,
    dest_token_account,
    keypair.publicKey,
    amount,
    USDC_DECIMALS,
    [],
    TOKEN_PROGRAM_ID
  );

  // Create the transaction and add the instruction
  const tx = new Transaction();
  // Create the destination associated token account (if needed)
  create_ata_ix.instructions.map((ix) => tx.add(ix));
  // Send devSAMO
  tx.add(transfer_ix);

  // Send the transaction
  const signers = [keypair];
  const signature = await connection.sendTransaction(tx, signers);
  console.log("signature:", signature);

  // Wait for the transaction to be confirmed
  const latest_blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...latest_blockhash });
}

main();
