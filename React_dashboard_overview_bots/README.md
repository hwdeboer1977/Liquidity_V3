# React dashboard to display current positions LP bots V3

- This project has a frontend and backend.
- The frontend shows the status of 8 liquidity provider bots at Pancakeswap/
- It shows the USD values and accrued fees.
- The backend server calls the Solidity fees to gather the information on these bots.

How to run the frontend?

- Development: npm run dev.
- Production: npm run build.
- This will start the Vite development server and open the app in your browser, usually at http://localhost:3000 or http://localhost:5173 (depending on your Vite setup).

How to run the backend?

- The code is here: "...\server\server.js".
- run with "node server/server.js".
- This script collects all the information from the different bots.
- These bots run on Pancakeswap (BASE and BSC chains).
- All info is collected at the backend and send to the front end website to display.
