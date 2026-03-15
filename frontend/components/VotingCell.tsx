"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../lib/WalletContext";
import { getWriteContract, MarketData } from "../lib/contract";

interface Props {
  market: MarketData;
  optionIndex: number;
  userStake: bigint;
  hasClaimed: boolean;
  onSuccess: () => void;
}

function pct(market: MarketData, i: number): number {
  const total = market.optionTotals.reduce((a, b) => a + b, 0n);
  if (total === 0n) return 0;
  return Number((market.optionTotals[i] * 100n) / total);
}

export function VotingCell({ market, optionIndex, userStake, hasClaimed, onSuccess }: Props) {
  const { signer, address } = useWallet();
  const [stakeInput, setStakeInput] = useState("0.01");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isWinner = market.resolved && market.winningOption === optionIndex;
  const isDeadlinePassed = market.deadline < Math.floor(Date.now() / 1000);
  const canVote = !market.resolved && !isDeadlinePassed && signer;
  const canClaim = market.resolved && isWinner && userStake > 0n && !hasClaimed && signer;

  async function handleVote() {
    if (!signer) return;
    setError("");
    setLoading(true);
    try {
      const contract = await getWriteContract(signer);
      const value = ethers.parseEther(stakeInput);
      const tx = await contract.vote(market.id, optionIndex, { value });
      await tx.wait();
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim() {
    if (!signer) return;
    setError("");
    setLoading(true);
    try {
      const contract = await getWriteContract(signer);
      const tx = await contract.claimReward(market.id);
      await tx.wait();
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const percentage = pct(market, optionIndex);
  const optionTotal = Number(ethers.formatEther(market.optionTotals[optionIndex])).toFixed(3);

  return (
    <div className={`voting-cell ${isWinner ? "voting-cell-winner" : ""} ${market.resolved && !isWinner ? "voting-cell-lost" : ""}`}>
      <div className="voting-cell-bar" style={{ width: `${percentage}%` }} />
      <div className="voting-cell-content">
        <div className="voting-cell-header">
          <span className="voting-cell-option">{market.options[optionIndex]}</span>
          {isWinner && <span className="winner-badge">🏆 Winner</span>}
        </div>
        <div className="voting-cell-stats">
          <span>{percentage}% · {optionTotal} ETH</span>
          {address && userStake > 0n && (
            <span className="your-stake">
              Your stake: {Number(ethers.formatEther(userStake)).toFixed(4)} ETH
            </span>
          )}
        </div>

        {canVote && (
          <div className="voting-cell-actions">
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              className="stake-input"
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={handleVote} disabled={loading}>
              {loading ? "…" : "Stake ETH"}
            </button>
          </div>
        )}

        {canClaim && (
          <button className="btn btn-success" onClick={handleClaim} disabled={loading}>
            {loading ? "Claiming…" : "Claim Reward"}
          </button>
        )}

        {hasClaimed && isWinner && (
          <p className="claimed-label">✓ Reward claimed</p>
        )}

        {error && <p className="error-msg">{error}</p>}
      </div>
    </div>
  );
}
