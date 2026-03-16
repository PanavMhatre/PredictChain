"use client";

import { useState } from "react";
import { useWallet } from "../lib/WalletContext";

interface Props {
  onClose: () => void;
}

export function SuggestMarketModal({ onClose }: Props) {
  const { address } = useWallet();
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [marketType, setMarketType] = useState<"EVENT" | "PRICE">("EVENT");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!question.trim()) return setError("Question is required.");
    if (!optionA.trim() || !optionB.trim()) return setError("At least 2 options are required.");
    if (!address) return setError("Connect your wallet first.");

    setLoading(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, optionA, optionB, optionC, marketType, submittedBy: address }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setSuccess(true);
    } catch {
      setError("Failed to submit suggestion. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Suggestion Submitted</h2>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body" style={{ alignItems: "center", textAlign: "center", padding: "2.5rem 1.5rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✓</div>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Thanks for your suggestion!</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              The market owner will review it and may add it to PredictChain.
            </p>
            <button className="btn btn-primary" style={{ marginTop: "1.5rem" }} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Suggest a Market</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <p className="form-hint" style={{ marginTop: 0 }}>
            Have an idea for a prediction market? Submit it and the owner will review it.
          </p>

          {/* Question */}
          <div className="form-group">
            <label className="form-label">Question</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Will SpaceX land on Mars by 2030?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Type */}
          <div className="form-group">
            <label className="form-label">Market Type</label>
            <div className="type-toggle">
              <button type="button" className={`type-toggle-btn ${marketType === "EVENT" ? "active" : ""}`}
                onClick={() => setMarketType("EVENT")} disabled={loading}>EVENT</button>
              <button type="button" className={`type-toggle-btn ${marketType === "PRICE" ? "active" : ""}`}
                onClick={() => setMarketType("PRICE")} disabled={loading}>PRICE</button>
            </div>
          </div>

          {/* Options */}
          <div className="form-group">
            <label className="form-label">Options</label>
            <div className="options-list">
              <div className="option-row">
                <span className="option-index">1</span>
                <input className="form-input" type="text" placeholder="Option 1" value={optionA}
                  onChange={(e) => setOptionA(e.target.value)} disabled={loading} />
              </div>
              <div className="option-row">
                <span className="option-index">2</span>
                <input className="form-input" type="text" placeholder="Option 2" value={optionB}
                  onChange={(e) => setOptionB(e.target.value)} disabled={loading} />
              </div>
              <div className="option-row">
                <span className="option-index">3</span>
                <input className="form-input" type="text" placeholder="Option 3 (optional)" value={optionC}
                  onChange={(e) => setOptionC(e.target.value)} disabled={loading} />
              </div>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Submitting…" : "Submit Suggestion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
