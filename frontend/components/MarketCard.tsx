"use client";

import Link from "next/link";
import { ethers } from "ethers";
import { MarketData } from "../lib/contract";

function timeLabel(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % 3600) / 60);
  return `${hours}h ${mins}m left`;
}

function totalPct(market: MarketData, i: number): number {
  const total = market.optionTotals.reduce((a, b) => a + b, 0n);
  if (total === 0n) return 0;
  return Number((market.optionTotals[i] * 100n) / total);
}

export function MarketCard({ market }: { market: MarketData }) {
  const pool = Number(ethers.formatEther(market.totalPool)).toFixed(3);
  const typeLabel = market.marketType === 1 ? "PRICE" : "EVENT";
  const isExpired = market.deadline < Math.floor(Date.now() / 1000);

  return (
    <Link href={`/market/${market.id}`} className="market-card">
      <div className="market-card-header">
        <span className={`type-badge type-${typeLabel.toLowerCase()}`}>{typeLabel}</span>
        <span className={`status-badge ${market.resolved ? "resolved" : isExpired ? "expired" : "active"}`}>
          {market.resolved ? "Resolved" : isExpired ? "Awaiting Resolution" : timeLabel(market.deadline)}
        </span>
      </div>
      <h2 className="market-card-question">{market.question}</h2>
      {market.marketType === 1 && market.ticker && (
        <p className="market-card-ticker">
          {market.ticker.toUpperCase()} · target ${(Number(market.targetPrice) / 100).toLocaleString()}
        </p>
      )}
      <div className="market-card-options">
        {market.options.slice(0, 3).map((opt, i) => {
          const pct = totalPct(market, i);
          const isWinner = market.resolved && market.winningOption === i;
          return (
            <div key={i} className={`option-bar ${isWinner ? "winner" : ""}`}>
              <div className="option-bar-fill" style={{ width: `${pct}%` }} />
              <span className="option-bar-label">{opt}</span>
              <span className="option-bar-pct">{pct}%</span>
            </div>
          );
        })}
        {market.options.length > 3 && (
          <p className="option-more">+{market.options.length - 3} more options</p>
        )}
      </div>
      <div className="market-card-footer">
        <span>Pool: {pool} ETH</span>
        <span className="market-card-arrow">→</span>
      </div>
    </Link>
  );
}
