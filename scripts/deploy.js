import hre from "hardhat";

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

  // Seed sample markets
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 86400;
  const oneWeek = oneDay * 7;

  console.log("\nSeeding sample markets...");

  // Market 1: Crypto prediction
  const tx1 = await market.createMarket(
    "Will Bitcoin hit $200,000 by end of 2026?",
    ["Yes, it will moon!", "No, bears win", "Maybe around $150k"],
    now + oneWeek * 4
  );
  await tx1.wait();
  console.log("Created market 0: Bitcoin price prediction");

  // Market 2: Sports
  const tx2 = await market.createMarket(
    "Who wins the 2026 World Cup?",
    ["Brazil", "Argentina", "France", "England", "Other"],
    now + oneWeek * 52
  );
  await tx2.wait();
  console.log("Created market 1: World Cup prediction");

  // Market 3: Tech
  const tx3 = await market.createMarket(
    "Which AI company will dominate in 2027?",
    ["OpenAI", "Google DeepMind", "Anthropic", "Meta AI", "A new startup"],
    now + oneWeek * 26
  );
  await tx3.wait();
  console.log("Created market 2: AI dominance prediction");

  console.log("\nAll markets seeded! Contract address:", contractAddress);
  console.log("\nAdd this to your frontend .env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("NEXT_PUBLIC_CHAIN_ID=31337");
  console.log("NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
