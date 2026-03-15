# PredictChain — Voting-Based Blockchain Prediction Market

A full-stack decentralized prediction market built with Solidity, Hardhat, Ethers.js, and Next.js. Uses **fake ETH** on a local Hardhat network — no real money involved. Markets resolve **automatically** using live data and AI reasoning — no manual intervention required.

## How It Works

- **Markets** are prediction questions with multiple outcome options ("cells")
- **Users stake fake FETH** on their predicted outcome
- **Winners split the entire pool** proportional to their stake
- **Markets resolve automatically** once their deadline passes — the resolver daemon fetches live data and uses AI to determine the correct outcome and call `resolveMarket` on-chain
- Everything runs on a local Hardhat blockchain — 10 accounts each preloaded with 10,000 fake ETH

## Market Types

### EVENT Markets
General prediction questions (e.g. "Who wins the 2026 World Cup?"). When the deadline passes, the resolver:
1. Scrapes live news headlines and snippets from DuckDuckGo (no API key required) for the past week
2. Sends the question, options, and news context to an AI model via OpenRouter
3. The AI reasons over the current real-world facts and returns the winning option index and a human-readable explanation
4. The resolver submits the result on-chain via `resolveMarket`

### PRICE Markets
Crypto price predictions (e.g. "Will Bitcoin hit $200,000?"). When the deadline passes, the resolver:
1. Fetches the live price in USD from the CoinGecko API using the market's `ticker` (CoinGecko ID)
2. Compares the current price against the market's `targetPrice` (stored in USD cents)
3. Passes the price data and options to AI, which maps the result to the correct option (including "close but not quite" buckets)
4. The resolver submits the result on-chain

## Quick Start

### 1. Start the Hardhat Local Node

```bash
npm run node
```

Keep this running. It will print 10 test account addresses and private keys.

### 2. Deploy the Contract & Seed Markets

In a new terminal:

```bash
npm run deploy
```

Copy the contract address printed (e.g. `0x5FbDB2315678afecb367f032d93F642f64180aa3`)

### 3. Configure the Frontend

Edit `frontend/.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=<paste address here>
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

### 4. Run the Frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Set Up MetaMask

1. Install MetaMask browser extension
2. Add a new network:
   - **Network Name**: Hardhat Local
   - **RPC URL**: http://127.0.0.1:8545
   - **Chain ID**: 31337
   - **Currency Symbol**: FETH
3. Import a test account using a private key from the Hardhat node output

### 6. Start the Auto-Resolver

In a new terminal, add your OpenRouter API key to `.env`:

```
OPENROUTER_API_KEY=sk-or-...
```

Then run:

```bash
CONTRACT_ADDRESS=<paste address here> node scripts/resolver.js
```

The resolver polls all markets every 60 seconds. When a market's deadline passes it fetches live data, calls the AI, and resolves the market on-chain automatically.

## Project Structure

```
PredictChain/
├── contracts/
│   └── PredictionMarket.sol    # Solidity smart contract
├── scripts/
│   ├── deploy.js               # Deploy + seed markets
│   └── resolver.js             # Auto-resolver daemon
├── hardhat.config.js           # Hardhat 3 config
├── frontend/                   # Next.js app
│   ├── app/
│   │   ├── page.tsx            # Market grid home page
│   │   └── market/[id]/        # Market detail + voting cells
│   ├── lib/
│   │   ├── contract.ts         # Ethers.js helpers
│   │   ├── abi.ts              # Contract ABI
│   │   ├── WalletContext.tsx   # Wallet state (React context)
│   │   └── useMarketEvents.ts  # Real-time event listeners
│   └── components/
│       ├── Navbar.tsx
│       ├── WalletConnect.tsx
│       ├── MarketCard.tsx
│       └── VotingCell.tsx
└── README.md
```

## Smart Contract

### Functions

| Function | Description |
|---|---|
| `createMarket(question, options[], deadline, marketType, targetPrice, ticker)` | Owner creates a prediction market |
| `vote(marketId, optionIndex)` | Payable — stake FETH on an outcome cell |
| `resolveMarket(marketId, winningOption, reason)` | Owner resolves with winning option and explanation |
| `claimReward(marketId)` | Winners claim their proportional payout |
| `getMarket(marketId)` | Returns full market data including type, targetPrice, ticker |
| `getOptionTotal(marketId, optionIndex)` | Total ETH staked on a given option |
| `getUserStake(marketId, optionIndex, user)` | A user's stake on a specific option |
| `hasUserClaimed(marketId, user)` | Whether a user has already claimed their reward |

### Market Struct

| Field | Description |
|---|---|
| `question` | The prediction question |
| `options` | Array of 2–10 outcome strings |
| `deadline` | Unix timestamp after which the market can be resolved |
| `resolved` | Whether the market has been resolved |
| `winningOption` | Index of the winning option (set on resolution) |
| `totalPool` | Total ETH staked across all options |
| `marketType` | `EVENT` (0) or `PRICE` (1) |
| `targetPrice` | Target price in USD cents for PRICE markets (e.g. `20000000` = $200,000) |
| `ticker` | CoinGecko asset ID for PRICE markets (e.g. `"bitcoin"`) |

## Auto-Resolver (`scripts/resolver.js`)

The resolver is a Node.js daemon that runs independently of the frontend.

| Setting | Value |
|---|---|
| Poll interval | 60 seconds |
| AI model | `anthropic/claude-opus-4-5` via OpenRouter |
| News source | DuckDuckGo HTML search — past week, no API key needed |
| Price source | CoinGecko public API |

**Required environment variables:**
- `CONTRACT_ADDRESS` — address of the deployed contract
- `OPENROUTER_API_KEY` — your OpenRouter key
- `RPC_URL` *(optional)* — defaults to `http://127.0.0.1:8545`

## Seeded Markets

| # | Question | Type | Details |
|---|---|---|---|
| 0 | Will Bitcoin hit $200,000 by end of 2026? | PRICE | target $200k, ticker `bitcoin` |
| 1 | Who wins the 2026 World Cup? | EVENT | 5 options |
| 2 | Which AI company will dominate in 2027? | EVENT | 5 options |
| 3 | Will Ethereum hit $10,000 by end of 2026? | PRICE | target $10k, ticker `ethereum` |
