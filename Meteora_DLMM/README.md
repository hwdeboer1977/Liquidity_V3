# Rebalancer bot for LP positions at Meteora DEX

- This bot is programmed with Typescript.
- It creates a DLMM LP for USDC/SOL.
- Users can adjust settings such as slippage, bins etc.
- It used the following SDK: https://www.npmjs.com/package/@meteora-ag/dlmm.

To optimize the LP it used the following Rebalancing Strategy:

- Introduce a Confirmation Time (Wait Before Rebalancing)
- Use a Buffer Zone (Avoid Frequent Rebalancing)
- Adapt to Market Volatility (e.g. wider/smaller range for lower/higher volatility)

Create a new LP postion at the Meteora DEX with:

- ...\src\01_initializeLP_DLMM.ts

Monitor current LP position, and rebalances if out of range, with:

- ...\src\02_monitorLP_DLMM.ts
