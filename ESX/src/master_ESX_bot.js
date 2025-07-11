const createLP = require("./esx_bot_create_lp.js");
const pullLP = require("./esx_bot_pull_lp.js");
const getPosition = require("./esx_bot_position.js");
const swapTokens = require("./esx_bot_swap.js");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  try {
    console.log("🔄 Running bot cycle:", new Date().toLocaleString());

    const LPinRange = await getPosition();
    await delay(10000);
    console.log("LPinRange:", LPinRange);

    if (LPinRange === 2 || LPinRange === 3) {
      console.log("📉 Out of range. Rebalancing...");

      // Step 1: Pull LP
      //await pullLP();
      console.log("⏸ Waiting 10 seconds for chain to confirm...");
      //await delay(10000);

      // Step 2: Swap tokens
      await swapTokens();
      console.log("⏸ Waiting 10 seconds before next step...");
      await delay(10000);

      // Step 3: Create new LP
      await createLP();

      console.log("✅ New LP position created.");
    } else {
      console.log("✅ LP still in range. No action needed.");
    }
  } catch (err) {
    console.error("❌ Error in bot cycle:", err);
  }
}

// Run once at start
main();

// Run every 5 minutes
setInterval(main, 5 * 60 * 1000);

// swapTokens();
// createLP();
