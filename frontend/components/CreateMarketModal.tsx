"use client";

import { useState } from "react";
import { useWallet } from "../lib/WalletContext";
import { getWriteContract } from "../lib/contract";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_OPTIONS = ["", ""];

export function CreateMarketModal({ onClose, onSuccess }: Props) {
  const { signer } = useWallet();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [marketType, setMarketType] = useState<0 | 1>(0);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [targetPriceUSD, setTargetPriceUSD] = useState("");
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setOption(i: number, val: string) {
    const next = [...options];
    next[i] = val;
    setOptions(next);
  }

  function addOption() {
    if (options.length < 10) setOptions([...options, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return setError("Question is required.");
    if (cleanOptions.length < 2) return setError("At least 2 options are required.");
    if (!deadlineDate) return setError("Deadline is required.");

    const deadlineTs = Math.floor(new Date(deadlineDate).getTime() / 1000);
    if (deadlineTs <= Math.floor(Date.now() / 1000))
      return setError("Deadline must be in the future.");

    if (marketType === 1) {
      if (!ticker.trim()) return setError("Ticker is required for PRICE markets.");
      if (!targetPriceUSD || isNaN(Number(targetPriceUSD)) || Number(targetPriceUSD) <= 0)
        return setError("Target price must be a positive number.");
    }

    const targetPriceCents = marketType === 1 ? Math.round(Number(targetPriceUSD) * 100) : 0;

    setLoading(true);
    try {
      const contract = await getWriteContract(signer!);
      const tx = await contract.createMarket(
        question.trim(),
        cleanOptions,
        deadlineTs,
        marketType,
        targetPriceCents,
        marketType === 1 ? ticker.trim().toLowerCase() : ""
      );
      await tx.wait();
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED"))
        setError("Transaction rejected in MetaMask.");
      else if (msg.includes("Not owner"))
        setError("Only the contract owner can create markets.");
      else
        setError("Transaction failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const minDate = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Prediction Market</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">

          {/* Question */}
          <div className="form-group">
            <label className="form-label">Question</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Will Bitcoin hit $300,000 by end of 2027?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Market Type */}
          <div className="form-group">
            <label className="form-label">Market Type</label>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-toggle-btn ${marketType === 0 ? "active" : ""}`}
                onClick={() => setMarketType(0)}
                disabled={loading}
              >
                EVENT
              </button>
              <button
                type="button"
                className={`type-toggle-btn ${marketType === 1 ? "active" : ""}`}
                onClick={() => setMarketType(1)}
                disabled={loading}
              >
                PRICE
              </button>
            </div>
            <p className="form-hint">
              {marketType === 0
                ? "Resolved by AI using live news — for sports, politics, tech events."
                : "Resolved by live CoinGecko price vs your target — for crypto/asset price predictions."}
            </p>
          </div>

          {/* PRICE fields */}
          {marketType === 1 && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Target Price (USD)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 200000"
                  value={targetPriceUSD}
                  onChange={(e) => setTargetPriceUSD(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label className="form-label">CoinGecko Ticker ID</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. bitcoin, ethereum, solana"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Deadline */}
          <div className="form-group">
            <label className="form-label">Deadline</label>
            <input
              className="form-input"
              type="datetime-local"
              min={minDate}
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Options */}
          <div className="form-group">
            <label className="form-label">Options <span className="form-hint-inline">(2–10)</span></label>
            <div className="options-list">
              {options.map((opt, i) => (
                <div key={i} className="option-row">
                  <span className="option-index">{i + 1}</span>
                  <input
                    className="form-input"
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    disabled={loading}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="option-remove"
                      onClick={() => removeOption(i)}
                      disabled={loading}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button
                type="button"
                className="btn-add-option"
                onClick={addOption}
                disabled={loading}
              >
                + Add Option
              </button>
            )}
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Creating…" : "Create Market"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
