import hre from "hardhat";

// MarketType enum: 0 = EVENT, 1 = PRICE
const MarketType = { EVENT: 0, PRICE: 1 };

async function main() {
  const connection = await hre.network.connect();
  const ethers = connection.ethers;

  const [deployer] = await ethers.getSigners();

  console.log("Deploying PredictionMarket with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const market = await PredictionMarket.deploy();
  await market.waitForDeployment();

  const contractAddress = await market.getAddress();
  console.log("PredictionMarket deployed to:", contractAddress);

  const now = Math.floor(Date.now() / 1000);
  const oneDay = 86400;
  const oneWeek = oneDay * 7;

  console.log("\nSeeding sample markets...");

  // PRICE market: Bitcoin hits $200k
  // targetPrice in USD cents: $200,000 = 20_000_000 cents
  const tx1 = await market.createMarket(
    "Will Bitcoin hit $200,000 by end of 2026?",
    ["Yes, it will moon!", "No, bears win", "Maybe around $150k"],
    now + oneWeek * 52,
    MarketType.PRICE,
    20_000_000,   // $200,000 in cents
    "bitcoin"     // CoinGecko ID
  );
  await tx1.wait();
  console.log("Created market 0: Bitcoin price prediction (PRICE type, target $200k)");

  // EVENT market: World Cup
  const tx2 = await market.createMarket(
    "Who wins the 2026 World Cup?",
    ["Brazil", "Argentina", "France", "England", "Other"],
    now + oneWeek * 52,
    MarketType.EVENT,
    0,
    ""
  );
  await tx2.wait();
  console.log("Created market 1: World Cup prediction (EVENT type)");

  // EVENT market: AI dominance
  const tx3 = await market.createMarket(
    "Which AI company will dominate in 2027?",
    ["OpenAI", "Google DeepMind", "Anthropic", "Meta AI", "A new startup"],
    now + oneWeek * 26,
    MarketType.EVENT,
    0,
    ""
  );
  await tx3.wait();
  console.log("Created market 2: AI dominance prediction (EVENT type)");

  // PRICE market: Ethereum hits $10k
  const tx4 = await market.createMarket(
    "Will Ethereum hit $10,000 by end of 2026?",
    ["Yes", "No", "Close but not quite ($8k-$9.9k)"],
    now + oneWeek * 52,
    MarketType.PRICE,
    1_000_000,    // $10,000 in cents
    "ethereum"    // CoinGecko ID
  );
  await tx4.wait();
  console.log("Created market 3: Ethereum price prediction (PRICE type, target $10k)");

  console.log("\nAll markets seeded! Contract address:", contractAddress);
  console.log("\nAdd this to your frontend .env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("NEXT_PUBLIC_CHAIN_ID=31337");
  console.log("NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545");
  console.log("\nThen start the resolver in a new terminal:");
  console.log(`CONTRACT_ADDRESS=${contractAddress} node scripts/resolver.js`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
