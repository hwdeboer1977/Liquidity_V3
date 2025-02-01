import { Keypair, Connection } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

export const connection = new Connection(process.env.RPC_URL!, "confirmed");

// Fix: Ensure private key is parsed safely
let secretKey: Uint8Array;
try {
  secretKey = Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY || "[]"));
} catch (error) {
  console.error(
    "Error parsing PRIVATE_KEY from .env. Ensure it's a valid JSON array."
  );
  process.exit(1);
}

const keypair = Keypair.fromSecretKey(secretKey);
//const wallet = new Wallet(keypair);
