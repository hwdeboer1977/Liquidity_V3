# Liquidity V3

### Automated Bots for Concentrated Liquidity Management

This repository contains a collection of liquidity provider (LP) bots designed to automate liquidity provision across major decentralized exchanges (DEXs) that support concentrated liquidity. Each bot creates and manages LP positions within a specified price range, streamlining the process for users.

## ✅ Features

- 📈 **Auto-Liquidity Provisioning**: Bots automatically provide liquidity in defined price ranges (e.g., -10% to +10%).
- 🛠️ **Customizable Parameters**: Easily configure ranges and update positions with minimal effort.
- 🔄 **Cross-DEX Support**: Compatible with Uniswap V3, PancakeSwap V3, Orca (Solana), and Meteora DLMM.
- 📊 **React Dashboard**: Visual interface for monitoring LP positions, performance, and activity.

## 📁 Structure

```bash
Liquidity_V3/
├── ESX/                          # Advanced LP logic for ESX token pairs
├── Meteora_DLMM/                # Meteora-specific LP bot examples (Solana)
├── Orca_solana_LP_bots_v3/      # Orca LP bot logic on Solana
├── PCS_LP_bots_v3/              # PancakeSwap V3 LP bots
├── React_dashboard_overview_bots/ # Dashboard frontend to monitor bots
├── Uniswap_LP_bots_v3/          # Uniswap V3 LP bots (Ethereum, Base, etc.)
└── README.md
```

### 🚀 How It Works

- User sets a price range, e.g., -10% to +10% from the current price.

- Bot fetches pool data, constructs the LP position, and deploys it using the relevant SDK or contracts.

- Fees are auto-collected while the position remains in range.

- (Optional) Rebalancing and removal strategies can be added.

### 🧰 Dependencies

- JavaScript / Node.js
- ethers.js / solana-web3.js
- Uniswap V3 SDK
- PancakeSwap V3 SDK
- Orca SDK
- Meteora SDK
- React (for dashboard)

### 🌐 Supported Protocols

DEX Chain(s)

- Uniswap V3: Ethereum, Base, Arbitrum
- PancakeSwap V3: BNB Chain, Base
- Orca: Solana
- Meteora: DLMM Solana

### 📊 Dashboard Preview

- A React-based interface to visualize:

👨‍💻 Author
Henk Wim de Boer
Smart Contract Developer & DeFi Strategist
@hwdeboer1977
