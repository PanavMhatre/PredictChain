# PredictChain — Voting-Based Blockchain Prediction Market

A full-stack decentralized prediction market built with Solidity, Hardhat, Ethers.js, and Next.js. Uses **fake ETH** on a local Hardhat network — no real money involved.

## How It Works

- **Markets** are prediction questions with multiple outcome options ("cells")
- **Users stake fake FETH** on their predicted outcome
- **Winners split the entire pool** proportional to their stake
- Everything runs on a local Hardhat blockchain — 10 accounts each preloaded with 10,000 fake ETH

## Quick Start

### 1. Start the Hardhat Local Node

```bash
cd prediction-market
npm run node
```

Keep this running. It will print 10 test account addresses and private keys.

### 2. Deploy the Contract & Seed Markets

In a new terminal:

```bash
cd prediction-market
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
cd prediction-market/frontend
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

## Project Structure

```
prediction-market/
├── contracts/
│   └── PredictionMarket.sol    # Solidity smart contract
├── scripts/
│   └── deploy.js               # Deploy + seed markets
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

## Smart Contract Functions

| Function | Description |
|---|---|
| `createMarket(question, options[], deadline)` | Owner creates a prediction market |
| `vote(marketId, optionIndex)` | Payable — stake FETH on an outcome cell |
| `resolveMarket(marketId, winningOption)` | Owner picks the winning cell |
| `claimReward(marketId)` | Winners claim their proportional payout |

## Seeded Markets

1. **Will Bitcoin hit $200,000 by end of 2026?** — 3 options
2. **Who wins the 2026 World Cup?** — 5 options  
3. **Which AI company will dominate in 2027?** — 5 options
