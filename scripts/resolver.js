/**
 * PredictChain Auto-Resolver
 *
 * Polls all markets every 60 seconds. When a market's deadline has passed:
 *   - PRICE markets: fetches current price from CoinGecko, compares to target
 *   - EVENT markets: asks Claude to research the outcome and pick a winner
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... node scripts/resolver.js
 */

import { ethers } from "ethers";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const POLL_INTERVAL_MS = 60_000; // check every 60 seconds

if (!CONTRACT_ADDRESS) {
  console.error("ERROR: CONTRACT_ADDRESS env var is required.");
  console.error("Run: CONTRACT_ADDRESS=0x... node scripts/resolver.js");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY not found in .env");
  process.exit(1);
}

// ── Load ABI from compiled artifact ───────────────────────────────────────────

function loadAbi() {
  const artifactPath = join(
    __dirname,
    "../artifacts/contracts/PredictionMarket.sol/PredictionMarket.json"
  );
  try {
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    return artifact.abi;
  } catch {
    console.error("Could not load ABI. Make sure you've run: npx hardhat build");
    process.exit(1);
  }
}

// ── Ethers setup ──────────────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(RPC_URL);
const abi = loadAbi();

// Use the first Hardhat test account as the resolver (it's the owner/deployer)
async function getOwnerWallet() {
  const accounts = await provider.listAccounts();
  if (accounts.length === 0) {
    throw new Error("No accounts found. Is the Hardhat node running?");
  }
  // Hardhat exposes unlocked accounts — use the first one (the deployer/owner)
  return new ethers.JsonRpcSigner(provider, accounts[0].address);
}

// ── CoinGecko price fetcher ───────────────────────────────────────────────────

async function fetchPriceUSDCents(ticker) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ticker}&vs_currencies=usd`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data[ticker]?.usd) {
    throw new Error(`No price data for ticker: ${ticker}`);
  }

  const priceUSD = data[ticker].usd;
  const priceCents = Math.round(priceUSD * 100);
  console.log(`  [CoinGecko] ${ticker}: $${priceUSD.toLocaleString()} (${priceCents} cents)`);
  return priceCents;
}

// ── Claude AI event resolver ──────────────────────────────────────────────────

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function resolveEventWithClaude(question, options) {
  console.log(`  [Claude] Researching: "${question}"`);

  const optionsList = options
    .map((opt, i) => `  ${i}: "${opt}"`)
    .join("\n");

  const prompt = `You are resolving a prediction market. Based on your knowledge of current events, news, and publicly available information, determine the most likely winning outcome.

Question: ${question}

Options (by index):
${optionsList}

Instructions:
- Reason carefully about what is most likely true based on current world events and news
- Consider the state of the world as of today
- Return ONLY a JSON object in this exact format, nothing else:
{"winner": <index_number>, "reason": "<brief explanation of why this option wins>"}`;

  const message = await claude.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();
  console.log(`  [Claude] Response: ${raw}`);

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.winner !== "number" || parsed.winner < 0 || parsed.winner >= options.length) {
      throw new Error(`Invalid winner index: ${parsed.winner}`);
    }
    return { winner: parsed.winner, reason: parsed.reason || "Resolved by AI" };
  } catch {
    throw new Error(`Could not parse Claude response: ${raw}`);
  }
}

// ── Price market resolver ─────────────────────────────────────────────────────

async function resolvePriceMarket(market) {
  const { question, options, ticker, targetPrice } = market;
  const targetPriceUSD = targetPrice / 100;

  console.log(`  [Price] Target: $${targetPriceUSD.toLocaleString()} for ${ticker}`);

  const currentPriceCents = await fetchPriceUSDCents(ticker);
  const currentPriceUSD = currentPriceCents / 100;

  // Determine winner based on options structure
  // We look for options that suggest YES (hit target), NO (didn't), or CLOSE (within 25% below)
  let winner = 0;
  let reason = "";

  const hitTarget = currentPriceCents >= targetPrice;
  const closeThreshold = targetPrice * 0.75; // within 25% below target
  const isClose = currentPriceCents >= closeThreshold && currentPriceCents < targetPrice;

  // Try to find the best matching option index
  // Strategy: ask Claude to map the price outcome to the right option
  const priceContext = `The market question is: "${question}"
The target price was $${targetPriceUSD.toLocaleString()}.
The actual current price of ${ticker} is $${currentPriceUSD.toLocaleString()}.
Price ${hitTarget ? "HAS" : "has NOT"} reached the target. ${isClose ? "It is close (within 25% of target)." : ""}`;

  console.log(`  [Price] ${priceContext}`);

  const optionsList = options.map((opt, i) => `  ${i}: "${opt}"`).join("\n");

  const prompt = `${priceContext}

Options (by index):
${optionsList}

Based on the price outcome, which option index best represents the result?
Return ONLY JSON: {"winner": <index>, "reason": "<explanation>"}`;

  const message = await claude.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();
  console.log(`  [Claude] Price mapping: ${raw}`);

  const parsed = JSON.parse(raw);
  winner = parsed.winner;
  reason = parsed.reason || `Price is $${currentPriceUSD.toLocaleString()}, target was $${targetPriceUSD.toLocaleString()}`;

  return { winner, reason };
}

// ── Main resolution logic ─────────────────────────────────────────────────────

async function checkAndResolveMarkets() {
  console.log(`\n[${new Date().toISOString()}] Checking markets...`);

  const signer = await getOwnerWallet();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

  const marketCount = Number(await contract.marketCount());
  console.log(`  Found ${marketCount} markets`);

  const now = Math.floor(Date.now() / 1000);

  for (let id = 0; id < marketCount; id++) {
    try {
      const market = await contract.getMarket(id);
      const [question, options, deadline, resolved, , totalPool, marketType, targetPrice, ticker] = market;

      const deadlineTs = Number(deadline);
      const isExpired = now >= deadlineTs;
      const poolETH = ethers.formatEther(totalPool);

      if (resolved) {
        console.log(`  Market ${id}: already resolved, skipping`);
        continue;
      }

      if (!isExpired) {
        const remaining = deadlineTs - now;
        const hours = Math.floor(remaining / 3600);
        const days = Math.floor(hours / 24);
        console.log(`  Market ${id}: "${question.slice(0, 50)}..." — expires in ${days}d ${hours % 24}h`);
        continue;
      }

      console.log(`\n  >>> Market ${id} EXPIRED: "${question}"`);
      console.log(`      Total pool: ${poolETH} ETH | Type: ${marketType === 0n ? "EVENT" : "PRICE"}`);

      let winner, reason;

      if (marketType === 1n) {
        // PRICE market
        ({ winner, reason } = await resolvePriceMarket({
          question,
          options: [...options],
          ticker,
          targetPrice: Number(targetPrice),
        }));
      } else {
        // EVENT market — ask Claude
        ({ winner, reason } = await resolveEventWithClaude(question, [...options]));
      }

      console.log(`  >>> Resolving market ${id}: winner option ${winner} — "${options[winner]}"`);
      console.log(`  >>> Reason: ${reason}`);

      const tx = await contract.resolveMarket(id, winner, reason);
      await tx.wait();
      console.log(`  >>> Market ${id} resolved! TX: ${tx.hash}`);
    } catch (err) {
      console.error(`  ERROR processing market ${id}:`, err.message);
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

console.log("=".repeat(60));
console.log("  PredictChain Auto-Resolver");
console.log("=".repeat(60));
console.log(`  Contract:  ${CONTRACT_ADDRESS}`);
console.log(`  RPC:       ${RPC_URL}`);
console.log(`  Interval:  ${POLL_INTERVAL_MS / 1000}s`);
console.log("=".repeat(60));

// Run immediately on start, then on interval
checkAndResolveMarkets().catch(console.error);
setInterval(() => checkAndResolveMarkets().catch(console.error), POLL_INTERVAL_MS);
