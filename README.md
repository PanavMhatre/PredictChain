# PredictChain

> **Decentralized prediction markets on Ethereum — fully on-chain, AI-resolved, no oracles required.**

Live on Sepolia testnet → [predictchainmarket.vercel.app](https://predictchainmarket.vercel.app)

---

## Overview

PredictChain is a permissionless prediction market protocol where users stake ETH on real-world outcomes. When a market's deadline passes, an off-chain resolver daemon fetches live data — either a real-time asset price from CoinGecko or live news headlines scraped from the web — feeds it to an AI model, and submits the result on-chain trustlessly. Winners claim their proportional share of the entire pool.

No manual admin. No centralized oracle. Just smart contracts, live data, and AI reasoning.

---

## How It Works

### Staking
- Any wallet connects via MetaMask and stakes ETH on one or more outcome options
- Multiple stakes on the same option are additive
- Staking is open until the market deadline

### Resolution
When a market deadline passes, the resolver daemon automatically:

**For PRICE markets** (e.g. "Will Bitcoin hit $200k?")
1. Fetches the live spot price from the [CoinGecko](https://coingecko.com) public API
2. Compares against the market's `targetPrice` threshold
3. Sends price data + options to Claude via [OpenRouter](https://openrouter.ai) — the AI maps the result to the correct option
4. Calls `resolveMarket()` on-chain with the winner index and a human-readable reason

**For EVENT markets** (e.g. "Who wins the World Cup?")
1. Scrapes live news headlines from DuckDuckGo — no API key required, past-week filter
2. Feeds the question, options, and news context to Claude via OpenRouter
3. The AI reasons over current real-world facts and returns the winning option
4. Calls `resolveMarket()` on-chain with the winner index and reasoning

### Claiming
- Winners call `claimReward()` to receive their share: `totalPool × userStake / winnerPool`
- Losing stakes are redistributed to winners — zero rake, zero platform fee

---

## Architecture

```
PredictChain/
├── contracts/
│   └── PredictionMarket.sol      # Core Solidity contract (Hardhat 3, Solidity 0.8.24)
├── scripts/
│   ├── deploy.js                 # Deploy contract + seed markets (localhost & Sepolia)
│   └── resolver.js               # Auto-resolver daemon (Node.js, polls every 60s)
├── hardhat.config.js             # Hardhat 3 config — localhost + Sepolia networks
├── frontend/                     # Next.js 15 App Router frontend
│   ├── app/
│   │   ├── page.tsx              # Market grid — live balance + staked stats
│   │   └── market/[id]/page.tsx  # Market detail — voting cells + claim flow
│   ├── components/
│   │   ├── Navbar.tsx            # Sticky nav with live ETH balance pill
│   │   ├── WalletConnect.tsx     # MetaMask connect / disconnect / network check
│   │   ├── WalletStats.tsx       # Balance + total staked cards on home page
│   │   ├── MarketCard.tsx        # Market grid card with option bars + status
│   │   └── VotingCell.tsx        # Per-option stake input + claim button
│   └── lib/
│       ├── abi.ts                # Contract ABI
│       ├── contract.ts           # Ethers.js read/write helpers + data fetching
│       ├── WalletContext.tsx     # Global wallet state (React context)
│       └── useMarketEvents.ts    # Contract event listeners for real-time UI updates
└── vercel.json                   # Vercel deployment config
```

---

## Smart Contract

**`PredictionMarket.sol`** — deployed on Sepolia at [`0xaf406d8736D0633346E33432B697ee64ED5803Df`](https://sepolia.etherscan.io/address/0xaf406d8736D0633346E33432B697ee64ED5803Df)

### Market Types

| Type | Value | Use Case |
|---|---|---|
| `EVENT` | `0` | Any real-world event outcome — sports, politics, tech |
| `PRICE` | `1` | Asset price threshold — resolved via CoinGecko live price |

### Interface

| Function | Visibility | Description |
|---|---|---|
| `createMarket(question, options[], deadline, marketType, targetPrice, ticker)` | `onlyOwner` | Create a new prediction market |
| `vote(marketId, optionIndex)` | `payable` | Stake ETH on an outcome |
| `resolveMarket(marketId, winningOption, reason)` | `onlyOwner` | Resolve with winner + explanation string |
| `claimReward(marketId)` | public | Claim proportional payout if on winning side |
| `getMarket(marketId)` | `view` | Full market struct including type, targetPrice, ticker |
| `getOptionTotal(marketId, optionIndex)` | `view` | Total ETH staked on a specific option |
| `getUserStake(marketId, optionIndex, user)` | `view` | A specific user's stake on a specific option |
| `hasUserClaimed(marketId, user)` | `view` | Whether a user has already claimed |

### Market Struct

| Field | Type | Description |
|---|---|---|
| `question` | `string` | The prediction question |
| `options` | `string[]` | 2–10 outcome strings |
| `deadline` | `uint256` | Unix timestamp — voting closes, resolution opens |
| `resolved` | `bool` | Whether the market has been settled |
| `winningOption` | `uint8` | Winning option index (set on resolution) |
| `totalPool` | `uint256` | Total ETH staked across all options (wei) |
| `marketType` | `uint8` | `0` = EVENT, `1` = PRICE |
| `targetPrice` | `uint256` | Target price in USD cents for PRICE markets |
| `ticker` | `string` | CoinGecko asset ID for PRICE markets (e.g. `"bitcoin"`) |

### Events

```solidity
event MarketCreated(uint256 indexed marketId, string question, string[] options, uint256 deadline, uint8 marketType, uint256 targetPrice, string ticker);
event Voted(uint256 indexed marketId, uint8 optionIndex, address indexed voter, uint256 amount);
event MarketResolved(uint256 indexed marketId, uint8 winningOption, string reason);
event RewardClaimed(uint256 indexed marketId, address indexed claimer, uint256 amount);
```

---

## Auto-Resolver

The resolver (`scripts/resolver.js`) is a standalone Node.js daemon that monitors all markets and resolves them autonomously when their deadlines pass.

| Property | Value |
|---|---|
| Poll interval | 60 seconds |
| AI model | `anthropic/claude-opus-4-5` via OpenRouter |
| Price source | CoinGecko public REST API (no key required) |
| News source | DuckDuckGo HTML search — past week, no API key required |
| Resolution method | AI-grounded — cites live data in the on-chain reason string |

**Environment variables:**

```bash
CONTRACT_ADDRESS=0x...          # Deployed contract address
OPENROUTER_API_KEY=sk-or-...    # OpenRouter API key
RPC_URL=https://...             # Optional — defaults to http://127.0.0.1:8545
```

---

## Running Locally

### Prerequisites
- Node.js 18+
- MetaMask browser extension
- OpenRouter API key (free tier works)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the Hardhat node

```bash
npm run node
```

Spins up a local EVM with 10 accounts preloaded with 10,000 ETH each. Keep this running.

### 3. Deploy contract + seed markets

```bash
npm run deploy
```

Deploys to `localhost` (chain ID `31337`) and seeds 9 sample markets. Copy the printed contract address.

### 4. Configure the frontend

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=<contract address>
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

### 5. Configure MetaMask

Add a custom network:

| Field | Value |
|---|---|
| Network Name | Hardhat Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency Symbol | `ETH` |

Import one of the Hardhat test accounts using a private key from the node output.

### 6. Start the frontend

```bash
npm run frontend
```

Open [http://localhost:3000](http://localhost:3000)

### 7. Start the resolver

```bash
CONTRACT_ADDRESS=<contract address> npm run resolve
```

---

## Deploying to Sepolia

### 1. Configure `.env`

```bash
OPENROUTER_API_KEY=sk-or-...
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<alchemy-key>
SEPOLIA_PRIVATE_KEY=0x<deployer-private-key>
```

Get free Sepolia ETH from [sepoliafaucet.com](https://sepoliafaucet.com).

### 2. Deploy

```bash
npm run deploy:sepolia
```

### 3. Configure frontend

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=<contract address>
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<alchemy-key>
```

### 4. Deploy frontend to Vercel

Set the following environment variables in the Vercel project dashboard:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed contract address |
| `NEXT_PUBLIC_CHAIN_ID` | `11155111` |
| `NEXT_PUBLIC_RPC_URL` | Your Alchemy Sepolia URL |

Set **Root Directory** to `frontend` in Vercel project settings, then deploy.

### 5. Start the resolver

```bash
CONTRACT_ADDRESS=<contract address> \
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<alchemy-key> \
npm run resolve
```

---

## Live Markets

| # | Question | Type | Details |
|---|---|---|---|
| 0 | Will Bitcoin hit $200,000 by end of 2026? | PRICE | target $200k · `bitcoin` |
| 1 | Who wins the 2026 World Cup? | EVENT | 5 options |
| 2 | Which AI company will dominate in 2027? | EVENT | 5 options |
| 3 | Will Ethereum hit $10,000 by end of 2026? | PRICE | target $10k · `ethereum` |
| 4 | Will Solana hit $500 by end of 2026? | PRICE | target $500 · `solana` |
| 5 | Will the US enter a recession in 2026? | EVENT | 3 options |
| 6 | What will be the biggest iPhone 17 feature? | EVENT | 5 options |
| 7 | Will Gold hit $4,000/oz by end of 2026? | PRICE | target $4,000 · `gold` |
| 8 | Who will be the top scorer at the 2026 World Cup? | EVENT | 5 options |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Solidity 0.8.24, Hardhat 3 |
| Contract interaction | Ethers.js v6 |
| Frontend | Next.js 15 (App Router), TypeScript, React 19 |
| Wallet | MetaMask via `BrowserProvider` |
| Resolver AI | Claude (claude-opus-4-5) via OpenRouter |
| Price data | CoinGecko public API |
| News data | DuckDuckGo HTML scrape |
| Testnet | Ethereum Sepolia (chain ID 11155111) |
| Hosting | Vercel |

---

## License

MIT
