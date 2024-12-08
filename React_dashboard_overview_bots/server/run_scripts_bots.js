// Script to read all information from all the bots
// These bots run on Pancakeswap (BASE and BSC chain)
// The information is collected at the backend en published on the website
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

let valueUsdBot1 = 0;
let valueUsdBot2 = 0;
let valueUsdBot3 = 0;
let valueUsdBot5 = 0;

// Get all data from the bots
const {
  waitResult_short1,
} = require("C:/Users/hwdeb/Documents/p_bots/AdminPanel/server/get_overview_positions_PCS_BOT_1_short.js");
const {
  waitResult_short2,
} = require("C:/Users/hwdeb/Documents/p_bots/AdminPanel/server/get_overview_positions_PCS_BOT_2_short.js");
const {
  waitResult_short3,
} = require("C:/Users/hwdeb/Documents/p_bots/AdminPanel/server/get_overview_positions_PCS_BOT_3_short.js");
const {
  waitResult_short5,
} = require("C:/Users/hwdeb/Documents/p_bots/AdminPanel/server/get_overview_positions_PCS_BOT_5_short.js");

// Define a function to use as the callback
function handleSomeVariable_short1(exportUsdValueAll1) {
  valueUsdBot1 = exportUsdValueAll1;
}

// Define a function to use as the callback
function handleSomeVariable_short2(exportUsdValueAll1) {
  valueUsdBot2 = exportUsdValueAll1;
}

// Define a function to use as the callback
function handleSomeVariable_short3(exportUsdValueAll1) {
  valueUsdBot3 = exportUsdValueAll1;
}

// Define a function to use as the callback
function handleSomeVariable_short5(exportUsdValueAll1) {
  valueUsdBot5 = exportUsdValueAll1;
}

// Main function
async function getInfoBot1() {
  await waitResult_short1(handleSomeVariable_short1);
  console.log("USD value Bot 1:" + valueUsdBot1);
  await waitResult_short2(handleSomeVariable_short2);
  console.log("USD value Bot 2:" + valueUsdBot2);
  await waitResult_short3(handleSomeVariable_short3);
  console.log("USD value Bot 3:" + valueUsdBot3);
  await waitResult_short5(handleSomeVariable_short5);
  console.log("USD value Bot 5:" + valueUsdBot5);
}
getInfoBot1();
