/**
 * PredictChain Auto-Resolver
 *
 * Polls all markets every 60 seconds. When a market's deadline has passed:
 *   - PRICE markets: fetches live price from CoinGecko, AI maps result to option
 *   - EVENT markets: scrapes real news headlines via DuckDuckGo, feeds them to
 *                    AI which reasons over the actual current facts to pick a winner
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... node scripts/resolver.js
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL          = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const POLL_INTERVAL_MS = 60_000;

// Model via OpenRouter — swap to any supported model here
const OPENROUTER_MODEL = "anthropic/claude-opus-4-5";

if (!CONTRACT_ADDRESS) {
  console.error("ERROR: CONTRACT_ADDRESS env var is required.");
  console.error("Run: CONTRACT_ADDRESS=0x... node scripts/resolver.js");
  process.exit(1);
}
if (!process.env.OPENROUTER_API_KEY) {
  console.error("ERROR: OPENROUTER_API_KEY not found in .env");
  process.exit(1);
}

// ── Load ABI ──────────────────────────────────────────────────────────────────

function loadAbi() {
  const artifactPath = join(
    __dirname,
    "../artifacts/contracts/PredictionMarket.sol/PredictionMarket.json"
  );
  try {
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    return artifact.abi;
  } catch {
    console.error("Could not load ABI. Run: npx hardhat build");
    process.exit(1);
  }
}

// ── Ethers setup ──────────────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(RPC_URL);
const abi      = loadAbi();

async function getOwnerSigner() {
  const accounts = await provider.listAccounts();
  if (!accounts.length) throw new Error("No accounts found. Is the Hardhat node running?");
  return new ethers.JsonRpcSigner(provider, accounts[0].address);
}

// ── News scraper (DuckDuckGo HTML search — no API key needed) ─────────────────

/**
 * Searches DuckDuckGo for recent news about a query and returns up to
 * `maxResults` plain-text snippets. We hit the DuckDuckGo HTML endpoint,
 * parse out result titles + snippets, and return them as a string block
 * ready to paste into an AI prompt.
 */
async function scrapeNews(query, maxResults = 8) {
  console.log(`  [News] Searching: "${query}"`);

  const encoded = encodeURIComponent(query);
  // DuckDuckGo lite HTML — lightweight, no JS, scrapeable
  const url = `https://html.duckduckgo.com/html/?q=${encoded}&df=w`; // df=w = past week

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PredictChainResolver/1.0; +https://github.com/PanavMhatre/PredictChain)",
      Accept: "text/html",
    },
  });

  if (!res.ok) throw new Error(`DuckDuckGo fetch failed: ${res.status}`);

  const html = await res.text();

  // Extract result snippets using simple regex on the HTML structure
  const results = [];

  // Match result titles
  const titleRe = /class="result__title"[^>]*>.*?<a[^>]*>([^<]+)<\/a>/gs;
  const snippetRe = /class="result__snippet"[^>]*>([^<]+(?:<[^/][^>]*>[^<]*<\/[^>]+>)*[^<]*)<\/a>/gs;

  // Simpler approach: pull all visible text blocks from result snippets
  const blockRe = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = blockRe.exec(html)) !== null && results.length < maxResults) {
    // Strip inner HTML tags, decode entities
    const text = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 30) results.push(text);
  }

  // Also grab titles for extra context
  const titleBlock = /<a class="result__a"[^>]*>([\s\S]*?)<\/a>/g;
  const titles = [];
  while ((match = titleBlock.exec(html)) !== null && titles.length < maxResults) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text.length > 10) titles.push(text);
  }

  if (results.length === 0 && titles.length === 0) {
    console.log("  [News] No results found — AI will use training knowledge only");
    return null;
  }

  // Interleave titles + snippets
  const combined = titles
    .slice(0, maxResults)
    .map((t, i) => `• ${t}${results[i] ? `: ${results[i]}` : ""}`)
    .join("\n");

  console.log(`  [News] Got ${titles.length} results`);
  return combined;
}

// ── OpenRouter AI helper ──────────────────────────────────────────────────────

async function askAI(prompt, maxTokens = 400) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/PanavMhatre/PredictChain",
      "X-Title":      "PredictChain Resolver",
    },
    body: JSON.stringify({
      model:      OPENROUTER_MODEL,
      max_tokens: maxTokens,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ── Event market resolver (news-grounded) ────────────────────────────────────

async function resolveEventWithAI(question, options) {
  console.log(`  [AI] Resolving event: "${question}"`);

  // Scrape fresh news about the question
  const newsSnippets = await scrapeNews(question);

  const optionsList = options.map((opt, i) => `  ${i}: "${opt}"`).join("\n");

  const newsSection = newsSnippets
    ? `\nHere are recent news headlines and snippets retrieved right now from the web:\n${newsSnippets}\n`
    : "\n(No recent news found — use your best knowledge.)\n";

  const prompt = `You are an impartial resolver for a prediction market. Your job is to determine which option best reflects reality RIGHT NOW based on the latest available information.
${newsSection}
Market question: "${question}"

Options (by index):
${optionsList}

Instructions:
- Use the news headlines above as your primary source of truth
- Cross-reference with your own knowledge
- Pick the option that most accurately reflects the current real-world outcome
- Return ONLY a JSON object, nothing else:
{"winner": <index_number>, "reason": "<1-2 sentence explanation citing the evidence>"}`;

  const raw = await askAI(prompt, 400);
  console.log(`  [AI] Response: ${raw}`);

  // Strip markdown code fences if model wraps JSON in them
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed  = JSON.parse(cleaned);

  if (typeof parsed.winner !== "number" || parsed.winner < 0 || parsed.winner >= options.length) {
    throw new Error(`Invalid winner index: ${parsed.winner}`);
  }
  return { winner: parsed.winner, reason: parsed.reason || "Resolved by AI with live news" };
}

// ── Price market resolver ─────────────────────────────────────────────────────

async function fetchPriceUSDCents(ticker) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ticker}&vs_currencies=usd`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

  const data = await res.json();
  if (!data[ticker]?.usd) throw new Error(`No CoinGecko data for: ${ticker}`);

  const priceUSD   = data[ticker].usd;
  const priceCents = Math.round(priceUSD * 100);
  console.log(`  [CoinGecko] ${ticker}: $${priceUSD.toLocaleString()} → ${priceCents} cents`);
  return priceCents;
}

async function resolvePriceMarket(market) {
  const { question, options, ticker, targetPrice } = market;
  const targetPriceUSD  = targetPrice / 100;
  const currentPriceCents = await fetchPriceUSDCents(ticker);
  const currentPriceUSD   = currentPriceCents / 100;

  const hitTarget     = currentPriceCents >= targetPrice;
  const closeThresh   = targetPrice * 0.75;
  const isClose       = currentPriceCents >= closeThresh && !hitTarget;

  const priceContext = `Market: "${question}"
Target price: $${targetPriceUSD.toLocaleString()}
Current price of ${ticker}: $${currentPriceUSD.toLocaleString()}
Did it hit the target? ${hitTarget ? "YES" : "NO"}${isClose ? " (it is close — within 25% below target)" : ""}`;

  console.log(`  [Price] ${priceContext}`);

  const optionsList = options.map((opt, i) => `  ${i}: "${opt}"`).join("\n");

  const prompt = `${priceContext}

Options (by index):
${optionsList}

Based strictly on the price data above, which option index best represents the outcome?
Return ONLY JSON: {"winner": <index>, "reason": "<explanation>"}`;

  const raw     = await askAI(prompt, 200);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed  = JSON.parse(cleaned);

  console.log(`  [AI] Price mapping: winner=${parsed.winner} — ${parsed.reason}`);
  return {
    winner: parsed.winner,
    reason: parsed.reason || `${ticker} is $${currentPriceUSD.toLocaleString()}, target was $${targetPriceUSD.toLocaleString()}`,
  };
}

// ── Main poll loop ────────────────────────────────────────────────────────────

async function checkAndResolveMarkets() {
  console.log(`\n[${new Date().toISOString()}] Checking markets...`);

  const signer      = await getOwnerSigner();
  const contract    = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  const marketCount = Number(await contract.marketCount());
  const now         = Math.floor(Date.now() / 1000);

  console.log(`  Found ${marketCount} market(s)`);

  for (let id = 0; id < marketCount; id++) {
    try {
      const m = await contract.getMarket(id);
      const [question, options, deadline, resolved, , totalPool, marketType, targetPrice, ticker] = m;

      if (resolved) {
        console.log(`  Market ${id}: already resolved`);
        continue;
      }

      const deadlineTs = Number(deadline);
      if (now < deadlineTs) {
        const remaining = deadlineTs - now;
        const days  = Math.floor(remaining / 86400);
        const hours = Math.floor((remaining % 86400) / 3600);
        console.log(`  Market ${id}: "${question.slice(0, 55)}..." — expires in ${days}d ${hours}h`);
        continue;
      }

      const poolETH  = ethers.formatEther(totalPool);
      const typeLabel = marketType === 0n ? "EVENT" : "PRICE";
      console.log(`\n  >>> Market ${id} EXPIRED [${typeLabel}]: "${question}"`);
      console.log(`      Pool: ${poolETH} ETH`);

      let winner, reason;

      if (marketType === 1n) {
        ({ winner, reason } = await resolvePriceMarket({
          question,
          options:     [...options],
          ticker,
          targetPrice: Number(targetPrice),
        }));
      } else {
        ({ winner, reason } = await resolveEventWithAI(question, [...options]));
      }

      console.log(`  >>> Winner: option ${winner} — "${options[winner]}"`);
      console.log(`  >>> Reason: ${reason}`);

      const tx = await contract.resolveMarket(id, winner, reason);
      await tx.wait();
      console.log(`  >>> Resolved! TX: ${tx.hash}`);

    } catch (err) {
      console.error(`  ERROR on market ${id}:`, err.message);
    }
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────

console.log("=".repeat(60));
console.log("  PredictChain Auto-Resolver");
console.log("=".repeat(60));
console.log(`  Contract : ${CONTRACT_ADDRESS}`);
console.log(`  RPC      : ${RPC_URL}`);
console.log(`  Model    : ${OPENROUTER_MODEL} (via OpenRouter)`);
console.log(`  News     : DuckDuckGo live search (no API key needed)`);
console.log(`  Interval : ${POLL_INTERVAL_MS / 1000}s`);
console.log("=".repeat(60));

checkAndResolveMarkets().catch(console.error);
setInterval(() => checkAndResolveMarkets().catch(console.error), POLL_INTERVAL_MS);
