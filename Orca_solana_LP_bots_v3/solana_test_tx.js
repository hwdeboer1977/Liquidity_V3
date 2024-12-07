//sendSol.js
const solanaWeb3 = require("@solana/web3.js");
const bs58 = require("bs58");

require("dotenv").config();

async function getBalance() {
  const SOLANA_URL_MAINNET = process.env.SOLANA_URL;

  const connection = new solanaWeb3.Connection(SOLANA_URL_MAINNET);

  const walletKeyPair = solanaWeb3.Keypair.fromSecretKey(
    new Uint8Array(bs58.decode(process.env.WALLET_SECRET_1))
  );

  console.log("Public key: " + walletKeyPair.publicKey);
  let balanceWei = await connection.getBalance(walletKeyPair.publicKey);
  let balance = balanceWei / 1000000000;
  console.log("Balance: " + balance);
}

getBalance();
