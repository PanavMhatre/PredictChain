"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { fetchMarket, getReadContract, MarketData } from "../../../lib/contract";
import { VotingCell } from "../../../components/VotingCell";
import { useWallet } from "../../../lib/WalletContext";
import { useMarketEvents } from "../../../lib/useMarketEvents";

export default function MarketPage() {
  const params = useParams();
  const id = Number(params.id);
  const { address } = useWallet();

  const [market, setMarket] = useState<MarketData | null>(null);
  const [userStakes, setUserStakes] = useState<bigint[]>([]);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const m = await fetchMarket(id);
      setMarket(m);

      if (address) {
        const contract = getReadContract();
        const stakes = await Promise.all(
          m.options.map((_, i) => contract.getUserStake(id, i, address))
        );
        setUserStakes(stakes.map(BigInt));
        const claimed = await contract.hasUserClaimed(id, address);
        setHasClaimed(claimed);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load market");
    } finally {
      setLoading(false);
    }
  }, [id, address]);

  useEffect(() => { load(); }, [load]);
  useMarketEvents(load);

  if (loading) return <p className="loading-text">Loading market…</p>;
  if (error) return <p className="error-msg">{error}</p>;
  if (!market) return null;

  const isExpired = market.deadline < Math.floor(Date.now() / 1000);
  const deadlineDate = new Date(market.deadline * 1000).toLocaleString();
  const pool = Number(ethers.formatEther(market.totalPool)).toFixed(4);
  const typeLabel = market.marketType === 1 ? "PRICE" : "EVENT";

  return (
    <div>
      <Link href="/" className="back-link">← All markets</Link>

      <div className="market-detail-header">
        <div className="market-detail-meta">
          <span className={`type-badge type-${typeLabel.toLowerCase()}`}>{typeLabel}</span>
          <span className={`status-badge ${market.resolved ? "resolved" : isExpired ? "expired" : "active"}`}>
            {market.resolved ? "Resolved" : isExpired ? "Awaiting Resolution" : "Active"}
          </span>
        </div>
        <h1 className="market-detail-question">{market.question}</h1>
        <div className="market-detail-info">
          <span>Pool: {pool} ETH</span>
          <span>Deadline: {deadlineDate}</span>
          {market.marketType === 1 && market.ticker && (
            <span>
              {market.ticker.toUpperCase()} · target ${(Number(market.targetPrice) / 100).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {market.resolved && (
        <div className="resolved-box">
          <strong>Winner: {market.options[market.winningOption]}</strong>
        </div>
      )}

      <div className="voting-grid">
        {market.options.map((_, i) => (
          <VotingCell
            key={i}
            market={market}
            optionIndex={i}
            userStake={userStakes[i] ?? 0n}
            hasClaimed={hasClaimed}
            onSuccess={load}
          />
        ))}
      </div>

      {!address && (
        <div className="connect-prompt">
          Connect your wallet to stake ETH on an outcome.
        </div>
      )}
    </div>
  );
}
