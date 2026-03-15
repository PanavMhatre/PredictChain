import { ethers } from "ethers";
import { ABI } from "./abi";

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";

export const CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337"
);

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

export interface MarketData {
  id: number;
  question: string;
  options: string[];
  deadline: number;
  resolved: boolean;
  winningOption: number;
  totalPool: bigint;
  marketType: 0 | 1; // 0 = EVENT, 1 = PRICE
  targetPrice: bigint;
  ticker: string;
  optionTotals: bigint[];
}

export function getReadProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export function getReadContract() {
  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in your environment.");
  }
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, getReadProvider());
}

export async function getWriteContract(signer: ethers.Signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}

export async function fetchMarket(id: number): Promise<MarketData> {
  const contract = getReadContract();
  const m = await contract.getMarket(id);
  const [question, options, deadline, resolved, winningOption, totalPool, marketType, targetPrice, ticker] = m;

  const optionTotals: bigint[] = await Promise.all(
    Array.from({ length: options.length }, (_, i) =>
      contract.getOptionTotal(id, i)
    )
  );

  return {
    id,
    question,
    options: [...options],
    deadline: Number(deadline),
    resolved,
    winningOption: Number(winningOption),
    totalPool,
    marketType: Number(marketType) as 0 | 1,
    targetPrice,
    ticker,
    optionTotals,
  };
}

export async function fetchAllMarkets(): Promise<MarketData[]> {
  const contract = getReadContract();
  const count = Number(await contract.marketCount());
  const markets = await Promise.all(
    Array.from({ length: count }, (_, i) => fetchMarket(i))
  );
  return markets;
}
