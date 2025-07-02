/********* IMPORTS *********/
const { ethers } = require("ethers");
require("dotenv").config();
const { getNonce } = require("./helpers"); // import it

/********* CONFIG *********/
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const WALLET_ADDRESS = process.env.MY_WALLET;
const WALLET_SECRET = process.env.MY_PK_DEV_WALLET;

const provider = new ethers.providers.JsonRpcProvider(
  `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
);
const wallet = new ethers.Wallet(WALLET_SECRET, provider);

// Define MaxUint128 manually
const MaxUint128 = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffff");

// Uniswap V3 Position Manager
const positionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";

const INonfungiblePositionManagerABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) external returns (uint256 amount0, uint256 amount1)",
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) external returns (uint256 amount0, uint256 amount1)",
  "function multicall(bytes[] calldata data) payable external returns (bytes[] memory results)",
];

const positionManager = new ethers.Contract(
  positionManagerAddress,
  INonfungiblePositionManagerABI,
  wallet
);

/********* REMOVE LIQUIDITY + COLLECT *********/
async function removeLiquidity(nonce) {
  const balance = await positionManager.balanceOf(WALLET_ADDRESS);
  if (balance.eq(0)) {
    console.log("No positions found.");
    return;
  }

  const positionId = await positionManager.tokenOfOwnerByIndex(
    WALLET_ADDRESS,
    balance.sub(1)
  );

  console.log("Most recent NFT Position ID:", positionId.toString());

  const pos = await positionManager.positions(positionId);
  const liquidity = pos.liquidity;
  console.log("Liquidity: ", liquidity.toString());

  const deadline = Math.floor(Date.now() / 1000) + 600;

  const iface = new ethers.utils.Interface(INonfungiblePositionManagerABI);

  const decreaseLiquidityData = iface.encodeFunctionData("decreaseLiquidity", [
    {
      tokenId: positionId,
      liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline,
    },
  ]);

  const collectData = iface.encodeFunctionData("collect", [
    {
      tokenId: positionId,
      recipient: WALLET_ADDRESS,
      amount0Max: MaxUint128,
      amount1Max: MaxUint128,
    },
  ]);

  const multicallData = iface.encodeFunctionData("multicall", [
    [decreaseLiquidityData, collectData],
  ]);

  const tx = await wallet.sendTransaction({
    to: positionManagerAddress,
    data: multicallData,
    gasLimit: 500000,
    nonce: nonce, // <-- add this line
  });

  const receipt = await tx.wait(1);
  console.log("✅ Liquidity removed and tokens collected.");
  console.log("📤 TX Hash:", receipt.transactionHash);
  console.log("📦 Block Number:", receipt.blockNumber);
}

/********* MAIN ENTRY *********/
async function pullLP() {
  const nonce = await getNonce(); // for LP mint
  await removeLiquidity(nonce);
}

/********* EXPORT + STANDALONE *********/
module.exports = pullLP;

if (require.main === module) {
  pullLP().catch(console.error);
}
