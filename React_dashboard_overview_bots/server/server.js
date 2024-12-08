// This is the server.js for the backend
// This script collects all the information from the different bots
// These bots run on Pancakeswap (BASE and BSC chains)
// All info is collected at the backend and send to the front end website to display
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
let dataToSend1 = {};
let dataToSend2 = {};
let dataToSend3 = {};
let dataToSend4 = {};
let dataToSend5 = {};
let dataToSend6 = {};

let valueUsdBot1 = 0;
let valueUsdBot2 = 0;
let valueUsdBot3 = 0;
let valueUsdBot5 = 0;

let valueUsdReward1 = 0;
let valueUsdReward2 = 0;
let valueUsdReward3 = 0;
let valueUsdReward4 = 0;
let valueUsdReward5 = 0;
let valueUsdReward6 = 0;
let dataToSendReward = {};

let valueUsdRewardBase1 = 0;
let valueUsdRewardBase2 = 0;
let valueUsdRewardBase3 = 0;
let valueUsdRewardBase4 = 0;
let valueUsdRewardBase5 = 0;
let dataToSendRewardBase = {};

const {
  waitResult_short1,
} = require("./get_overview_positions_PCS_BOT_1_short.js");
const {
  waitResult_short2,
} = require("./get_overview_positions_PCS_BOT_2_short.js");
const {
  waitResult_short3,
} = require("./get_overview_positions_PCS_BOT_3_short.js");
const {
  waitResult_short5,
} = require("./get_overview_positions_PCS_BOT_5_short.js");

const { waitResult1 } = require("./get_overview_positions_PCS_BOT_1.js");
const { waitResult2 } = require("./get_overview_positions_PCS_BOT_2.js");
const { waitResult3 } = require("./get_overview_positions_PCS_BOT_3.js");
const { waitResult5 } = require("./get_overview_positions_PCS_BOT_5.js");

const { waitResultRewards } = require("./get_info_reward_wallet_BSC.js");

const { waitResultRewardsBase } = require("./get_info_reward_wallet_BASE.js");

// Define a function to use as the callback
function handleSomeVariable_short1(exportUsdValueAll1) {
  valueUsdBot1 = exportUsdValueAll1;
  dataToSend1 = {
    message1: valueUsdBot1,
  };
}

// Define a function to use as the callback
function handleSomeVariable_short2(exportUsdValueAll1) {
  valueUsdBot2 = exportUsdValueAll1;
  dataToSend2 = {
    message2: valueUsdBot2,
  };
}

// Define a function to use as the callback
function handleSomeVariable_short3(exportUsdValueAll1) {
  valueUsdBot3 = exportUsdValueAll1;
  dataToSend3 = {
    message3: valueUsdBot3,
  };
}

// Define a function to use as the callback
function handleSomeVariable_short5(exportUsdValueAll1) {
  valueUsdBot5 = exportUsdValueAll1;
  dataToSend5 = {
    message5: valueUsdBot5,
  };
}

function handleSomeVariableReward(
  exportUsdValueAll,
  exportUsdValueBNB,
  exportUsdValueBTC,
  exportUsdValueWBNB,
  exportUsdValueUSDT,
  exportUsdValueCAKE
) {
  valueUsdReward1 = exportUsdValueAll;
  valueUsdReward2 = exportUsdValueBNB;
  valueUsdReward3 = exportUsdValueBTC;
  valueUsdReward4 = exportUsdValueWBNB;
  valueUsdReward5 = exportUsdValueUSDT;
  valueUsdReward6 = exportUsdValueCAKE;
  dataToSendReward = {
    message1: valueUsdReward1,
    message2: valueUsdReward2,
    message3: valueUsdReward3,
    message4: valueUsdReward4,
    message5: valueUsdReward5,
    message6: valueUsdReward6,
  };
}

function handleSomeVariableRewardBase(
  exportUsdValueAll,
  exportUsdValueETH,
  exportUsdValueUSDC,
  exportUsdValueWETH,
  exportUsdValueCAKE
) {
  valueUsdRewardBase1 = exportUsdValueAll;
  valueUsdRewardBase2 = exportUsdValueETH;
  valueUsdRewardBase3 = exportUsdValueUSDC;
  valueUsdRewardBase4 = exportUsdValueWETH;
  valueUsdRewardBase5 = exportUsdValueCAKE;
  dataToSendRewardBase = {
    message1: valueUsdRewardBase1,
    message2: valueUsdRewardBase2,
    message3: valueUsdRewardBase3,
    message4: valueUsdRewardBase4,
    message5: valueUsdRewardBase5,
  };
}

async function getInfoBotAll() {
  await waitResult_short1(handleSomeVariable_short1);
  console.log("USD value Bot 1:" + valueUsdBot1);
  await waitResult_short2(handleSomeVariable_short2);
  console.log("USD value Bot 2:" + valueUsdBot2);
  await waitResult_short3(handleSomeVariable_short3);
  console.log("USD value Bot 3:" + valueUsdBot3);
  await waitResult_short5(handleSomeVariable_short5);
  console.log("USD value Bot 5:" + valueUsdBot5);
}

async function getInfoReward() {
  await waitResultRewards(handleSomeVariableReward);
  console.log("USD value Rewards wallet:" + valueUsdReward1);
}

async function getInfoRewardBase() {
  await waitResultRewardsBase(handleSomeVariableRewardBase);
  console.log("USD value Rewards wallet:" + valueUsdRewardBase1);
}

// Define a function to use as the callback
function handleSomeVariable(
  exportUsdValueAll,
  exportUsdValueBNB,
  exportUsdValueUSDT,
  exportUsdValueWBNB,
  exportUsdValueCAKEFee,
  exportUsdValueUSDTBot,
  exportUsdValueBNBBot,
  exportUsdValueUSDTFee,
  exportUsdValueWBNBFee,
  exportUsdValueCAKEW,
  exportUsdValueBNBW,
  exportUsdValueUSDTW,
  exportUsdValueWBNBW,
  exportUsdValueCAKE,
  exportUsdValueBotAll,
  exportUsdValueWalletAll
) {
  //valueUsdBot1 = exportUsdValueAll;
  dataToSend1 = {
    message1: exportUsdValueAll,
    message2: exportUsdValueBNB,
    message3: exportUsdValueUSDT,
    message4: exportUsdValueWBNB,
    message5: exportUsdValueCAKEFee,
    message6: exportUsdValueUSDTBot,
    message7: exportUsdValueBNBBot,
    message8: exportUsdValueUSDTFee,
    message9: exportUsdValueWBNBFee,
    message10: exportUsdValueCAKEW,
    message11: exportUsdValueBNBW,
    message12: exportUsdValueUSDTW,
    message13: exportUsdValueWBNBW,
    message14: exportUsdValueCAKE,
    message15: exportUsdValueBotAll,
    message16: exportUsdValueWalletAll,
  };
}

// Define a function to use as the callback
function handleSomeVariable2(
  exportUsdValueAll,
  exportUsdValueBNB,
  exportUsdValueBTC,
  exportUsdValueWBNB,
  exportUsdValueCAKEFee,
  exportUsdValueBTCBot,
  exportUsdValueBNBBot,
  exportUsdValueBTCFee,
  exportUsdValueWBNBFee,
  exportUsdValueCAKEW,
  exportUsdValueBNBW,
  exportUsdValueBTCW,
  exportUsdValueWBNBW,
  exportUsdValueCAKE,
  exportUsdValueBotAll,
  exportUsdValueWalletAll
) {
  //valueUsdBot1 = exportUsdValueAll;
  dataToSend2 = {
    message1: exportUsdValueAll,
    message2: exportUsdValueBNB,
    message3: exportUsdValueBTC,
    message4: exportUsdValueWBNB,
    message5: exportUsdValueCAKEFee,
    message6: exportUsdValueBTCBot,
    message7: exportUsdValueBNBBot,
    message8: exportUsdValueBTCFee,
    message9: exportUsdValueWBNBFee,
    message10: exportUsdValueCAKEW,
    message11: exportUsdValueBNBW,
    message12: exportUsdValueBTCW,
    message13: exportUsdValueWBNBW,
    message14: exportUsdValueCAKE,
    message15: exportUsdValueBotAll,
    message16: exportUsdValueWalletAll,
  };
}

// Define a function to use as the callback
function handleSomeVariable3(
  exportUsdValueAll,
  exportUsdValueBNB,
  exportUsdValueBTC,
  exportUsdValueWBNB,
  exportUsdValueCAKEFee,
  exportUsdValueBTCBot,
  exportUsdValueBNBBot,
  exportUsdValueBTCFee,
  exportUsdValueWBNBFee,
  exportUsdValueCAKEW,
  exportUsdValueBNBW,
  exportUsdValueBTCW,
  exportUsdValueWBNBW,
  exportUsdValueCAKE,
  exportUsdValueBotAll,
  exportUsdValueWalletAll
) {
  //valueUsdBot1 = exportUsdValueAll;
  dataToSend3 = {
    message1: exportUsdValueAll,
    message2: exportUsdValueBNB,
    message3: exportUsdValueBTC,
    message4: exportUsdValueWBNB,
    message5: exportUsdValueCAKEFee,
    message6: exportUsdValueBTCBot,
    message7: exportUsdValueBNBBot,
    message8: exportUsdValueBTCFee,
    message9: exportUsdValueWBNBFee,
    message10: exportUsdValueCAKEW,
    message11: exportUsdValueBNBW,
    message12: exportUsdValueBTCW,
    message13: exportUsdValueWBNBW,
    message14: exportUsdValueCAKE,
    message15: exportUsdValueBotAll,
    message16: exportUsdValueWalletAll,
  };
}

// Define a function to use as the callback
function handleSomeVariable5(
  exportUsdValueAll,
  exportUsdValueBNB,
  exportUsdValueBTC,
  exportUsdValueUSDT,
  exportUsdValueCAKEFee,
  exportUsdValueBTCBot,
  exportUsdValueUSDTBot,
  exportUsdValueBTCFee,
  exportUsdValueUSDTFee,
  exportUsdValueCAKEW,
  exportUsdValueBNBW,
  exportUsdValueBTCW,
  exportUsdValueUSDTW,
  exportUsdValueCAKE,
  exportUsdValueBotAll,
  exportUsdValueWalletAll
) {
  //valueUsdBot1 = exportUsdValueAll;
  dataToSend5 = {
    message1: exportUsdValueAll,
    message2: exportUsdValueBNB,
    message3: exportUsdValueBTC,
    message4: exportUsdValueUSDT,
    message5: exportUsdValueCAKEFee,
    message6: exportUsdValueBTCBot,
    message7: exportUsdValueUSDTBot,
    message8: exportUsdValueBTCFee,
    message9: exportUsdValueUSDTFee,
    message10: exportUsdValueCAKEW,
    message11: exportUsdValueBNBW,
    message12: exportUsdValueBTCW,
    message13: exportUsdValueUSDTW,
    message14: exportUsdValueCAKE,
    message15: exportUsdValueBotAll,
    message16: exportUsdValueWalletAll,
  };
}

async function getInfoBot1() {
  await waitResult1(handleSomeVariable);
  console.log("USD value Bot 1:" + valueUsdBot1);
}

async function getInfoBot2() {
  await waitResult2(handleSomeVariable2);
  console.log("USD value Bot 1:" + valueUsdBot1);
}

async function getInfoBot3() {
  await waitResult3(handleSomeVariable3);
  console.log("USD value Bot 1:" + valueUsdBot1);
}

async function getInfoBot5() {
  await waitResult5(handleSomeVariable5);
  console.log("USD value Bot 1:" + valueUsdBot1);
}

app.get("/messageoverview1", async (_req, res, _next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    Connection: "keep-alive", // allowing TCP connection to remain open for multiple HTTP requests/responses
    "Content-Type": "text/event-stream", // media type for Server Sent Events (SSE)
  });
  res.flushHeaders();

  try {
    await getInfoBotAll();
    const valueBot1 = dataToSend1.message1;
    const valueBot2 = dataToSend2.message2;
    const valueBot3 = dataToSend3.message3;
    const valueBot5 = dataToSend5.message5;

    res.write(
      `data: ${JSON.stringify({
        valueBot1,
        valueBot2,
        valueBot3,
        valueBot5,
      })}\n\n`
    );
    res.end();
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).end();
  }
});

app.get("/messagebot1", async (_req, res, _next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    Connection: "keep-alive", // allowing TCP connection to remain open for multiple HTTP requests/responses
    "Content-Type": "text/event-stream", // media type for Server Sent Events (SSE)
  });
  res.flushHeaders();

  try {
    await getInfoBot1();
    const valueBot1 = dataToSend1.message1;
    const valueBot2 = dataToSend1.message2;
    const valueBot3 = dataToSend1.message3;
    const valueBot4 = dataToSend1.message4;
    const valueBot5 = dataToSend1.message5;
    const valueBot6 = dataToSend1.message6;
    const valueBot7 = dataToSend1.message7;
    const valueBot8 = dataToSend1.message8;
    const valueBot9 = dataToSend1.message9;
    const valueBot10 = dataToSend1.message10;
    const valueBot11 = dataToSend1.message11;
    const valueBot12 = dataToSend1.message12;
    const valueBot13 = dataToSend1.message13;
    const valueBot14 = dataToSend1.message14;
    const valueBot15 = dataToSend1.message15;
    const valueBot16 = dataToSend1.message16;

    res.write(
      `data: ${JSON.stringify({
        valueBot1,
        valueBot2,
        valueBot3,
        valueBot4,
        valueBot5,
        valueBot6,
        valueBot7,
        valueBot8,
        valueBot9,
        valueBot10,
        valueBot11,
        valueBot12,
        valueBot13,
        valueBot14,
        valueBot15,
        valueBot16,
      })}\n\n`
    );
    res.end();
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).end();
  }
});

app.get("/messagebot2", async (_req, res, _next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    Connection: "keep-alive", // allowing TCP connection to remain open for multiple HTTP requests/responses
    "Content-Type": "text/event-stream", // media type for Server Sent Events (SSE)
  });
  res.flushHeaders();

  try {
    await getInfoBot2();
    const valueBot1 = dataToSend2.message1;
    const valueBot2 = dataToSend2.message2;
    const valueBot3 = dataToSend2.message3;
    const valueBot4 = dataToSend2.message4;
    const valueBot5 = dataToSend2.message5;
    const valueBot6 = dataToSend2.message6;
    const valueBot7 = dataToSend2.message7;
    const valueBot8 = dataToSend2.message8;
    const valueBot9 = dataToSend2.message9;
    const valueBot10 = dataToSend2.message10;
    const valueBot11 = dataToSend2.message11;
    const valueBot12 = dataToSend1.message12;
    const valueBot13 = dataToSend2.message13;
    const valueBot14 = dataToSend2.message14;
    const valueBot15 = dataToSend2.message15;
    const valueBot16 = dataToSend2.message16;

    res.write(
      `data: ${JSON.stringify({
        valueBot1,
        valueBot2,
        valueBot3,
        valueBot4,
        valueBot5,
        valueBot6,
        valueBot7,
        valueBot8,
        valueBot9,
        valueBot10,
        valueBot11,
        valueBot12,
        valueBot13,
        valueBot14,
        valueBot15,
        valueBot16,
      })}\n\n`
    );
    res.end();
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).end();
  }
});

app.get("/messagebot3", async (_req, res, _next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    Connection: "keep-alive", // allowing TCP connection to remain open for multiple HTTP requests/responses
    "Content-Type": "text/event-stream", // media type for Server Sent Events (SSE)
  });
  res.flushHeaders();

  try {
    await getInfoBot3();
    const valueBot1 = dataToSend3.message1;
    const valueBot2 = dataToSend3.message2;
    const valueBot3 = dataToSend3.message3;
    const valueBot4 = dataToSend3.message4;
    const valueBot5 = dataToSend3.message5;
    const valueBot6 = dataToSend3.message6;
    const valueBot7 = dataToSend3.message7;
    const valueBot8 = dataToSend3.message8;
    const valueBot9 = dataToSend3.message9;
    const valueBot10 = dataToSend3.message10;
    const valueBot11 = dataToSend3.message11;
    const valueBot12 = dataToSend3.message12;
    const valueBot13 = dataToSend3.message13;
    const valueBot14 = dataToSend3.message14;
    const valueBot15 = dataToSend3.message15;
    const valueBot16 = dataToSend3.message16;

    res.write(
      `data: ${JSON.stringify({
        valueBot1,
        valueBot2,
        valueBot3,
        valueBot4,
        valueBot5,
        valueBot6,
        valueBot7,
        valueBot8,
        valueBot9,
        valueBot10,
        valueBot11,
        valueBot12,
        valueBot13,
        valueBot14,
        valueBot15,
        valueBot16,
      })}\n\n`
    );
    res.end();
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).end();
  }
});

app.get("/messagebot5", async (_req, res, _next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    Connection: "keep-alive", // allowing TCP connection to remain open for multiple HTTP requests/responses
    "Content-Type": "text/event-stream", // media type for Server Sent Events (SSE)
  });
  res.flushHeaders();

  try {
    await getInfoBot5();
    const valueBot1 = dataToSend5.message1;
    const valueBot2 = dataToSend5.message2;
    const valueBot3 = dataToSend5.message3;
    const valueBot4 = dataToSend5.message4;
    const valueBot5 = dataToSend5.message5;
    const valueBot6 = dataToSend5.message6;
    const valueBot7 = dataToSend5.message7;
    const valueBot8 = dataToSend5.message8;
    const valueBot9 = dataToSend5.message9;
    const valueBot10 = dataToSend5.message10;
    const valueBot11 = dataToSend5.message11;
    const valueBot12 = dataToSend5.message12;
    const valueBot13 = dataToSend5.message13;
    const valueBot14 = dataToSend5.message14;
    const valueBot15 = dataToSend5.message15;
    const valueBot16 = dataToSend5.message16;

    res.write(
      `data: ${JSON.stringify({
        valueBot1,
        valueBot2,
        valueBot3,
        valueBot4,
        valueBot5,
        valueBot6,
        valueBot7,
        valueBot8,
        valueBot9,
        valueBot10,
        valueBot11,
        valueBot12,
        valueBot13,
        valueBot14,
        valueBot15,
        valueBot16,
      })}\n\n`
    );
    res.end();
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).end();
  }
});

app.get("/messagereward", async (_req, res, _next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    Connection: "keep-alive", // allowing TCP connection to remain open for multiple HTTP requests/responses
    "Content-Type": "text/event-stream", // media type for Server Sent Events (SSE)
  });
  res.flushHeaders();

  try {
    await getInfoReward();
    const valueReward1 = dataToSendReward.message1;
    const valueReward2 = dataToSendReward.message2;
    const valueReward3 = dataToSendReward.message3;
    const valueReward4 = dataToSendReward.message4;
    const valueReward5 = dataToSendReward.message5;
    const valueReward6 = dataToSendReward.message6;

    res.write(
      `data: ${JSON.stringify({
        valueReward1,
        valueReward2,
        valueReward3,
        valueReward4,
        valueReward5,
        valueReward6,
      })}\n\n`
    );
    res.end();
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).end();
  }
});

app.get("/messagerewardbase", async (_req, res, _next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    Connection: "keep-alive", // allowing TCP connection to remain open for multiple HTTP requests/responses
    "Content-Type": "text/event-stream", // media type for Server Sent Events (SSE)
  });
  res.flushHeaders();

  try {
    await getInfoRewardBase();
    const valueRewardBase1 = dataToSendRewardBase.message1;
    const valueRewardBase2 = dataToSendRewardBase.message2;
    const valueRewardBase3 = dataToSendRewardBase.message3;
    const valueRewardBase4 = dataToSendRewardBase.message4;
    const valueRewardBase5 = dataToSendRewardBase.message5;

    res.write(
      `data: ${JSON.stringify({
        valueRewardBase1,
        valueRewardBase2,
        valueRewardBase3,
        valueRewardBase4,
        valueRewardBase5,
      })}\n\n`
    );
    res.end();
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).end();
  }
});

app.listen(8000, () => {
  console.log(`Server is running on port 8000.`);
});
