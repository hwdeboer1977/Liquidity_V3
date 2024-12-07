import {
  Keypair,
  Connection,
  SystemProgram,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import secret from "./wallet.json";

const RPC_ENDPOINT_URL = "PUT YOUR API HERE";
const COMMITMENT = "confirmed";

async function main() {
  // Initialize a connection to the RPC and read in private key
  const connection = new Connection(RPC_ENDPOINT_URL, COMMITMENT);
  const keypair = Keypair.fromSecretKey(new Uint8Array(secret));
  console.log("endpoint:", connection.rpcEndpoint);
  console.log("wallet pubkey:", keypair.publicKey.toBase58());

  // SOL destination
  const dest_pubkey = new PublicKey(
    "Gkn9sNiDPyJM7ZB27WQS1R6vkH8nhRFUtNoTaDqbemvy"
  );

  // Amount to send
  const amount = 10_000_000; // lamports = 0.01 SOL

  // Build the instruction to send SOL
  const transfer_ix = SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: dest_pubkey,
    lamports: amount,
  });

  // Create a transaction and add the instruction
  const tx = new Transaction();
  tx.add(transfer_ix);

  // Send the transaction
  const signers = [keypair];
  const signature = await connection.sendTransaction(tx, signers);
  console.log("signature:", signature);

  // Wait for the transaction to complete
  const latest_blockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...latest_blockhash });
}

main();
