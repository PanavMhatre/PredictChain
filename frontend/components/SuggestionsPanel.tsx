"use client";

import { useEffect, useState } from "react";
import type { Suggestion } from "../app/api/suggestions/route";

interface Props {
  onClose: () => void;
  onUseIdea: (suggestion: Suggestion) => void;
}

export function SuggestionsPanel({ onClose, onUseIdea }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/suggestions");
      setSuggestions(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function dismiss(id: string) {
    await fetch("/api/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "rejected" }),
    });
    load();
  }

  async function deleteSuggestion(id: string) {
    await fetch("/api/suggestions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const shown = suggestions.filter((s) => filter === "pending" ? s.status === "pending" : true);
  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h2 className="modal-title">Market Suggestions</h2>
            {pendingCount > 0 && <span className="suggestions-badge">{pendingCount}</span>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="suggestions-filter">
          <button className={`filter-btn ${filter === "pending" ? "active" : ""}`}
            onClick={() => setFilter("pending")}>Pending</button>
          <button className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}>All</button>
        </div>

        <div className="suggestions-list">
          {loading && <p className="loading-text" style={{ padding: "1.5rem" }}>Loading…</p>}

          {!loading && shown.length === 0 && (
            <p style={{ color: "var(--text-muted)", padding: "1.5rem", fontSize: "0.875rem" }}>
              {filter === "pending" ? "No pending suggestions." : "No suggestions yet."}
            </p>
          )}

          {shown.map((s) => (
            <div key={s.id} className={`suggestion-item ${s.status !== "pending" ? "suggestion-item-dim" : ""}`}>
              <div className="suggestion-meta">
                <span className={`type-badge type-${s.marketType.toLowerCase()}`}>{s.marketType}</span>
                <span className={`suggestion-status suggestion-status-${s.status}`}>{s.status}</span>
                <span className="suggestion-from">
                  {s.submittedBy.slice(0, 6)}…{s.submittedBy.slice(-4)}
                </span>
                <span className="suggestion-date">
                  {new Date(s.submittedAt).toLocaleDateString()}
                </span>
              </div>

              <p className="suggestion-question">{s.question}</p>

              <div className="suggestion-options">
                {[s.optionA, s.optionB, s.optionC].filter(Boolean).map((opt, i) => (
                  <span key={i} className="suggestion-option-pill">{opt}</span>
                ))}
              </div>

              {s.status === "pending" && (
                <div className="suggestion-actions">
                  <button className="btn btn-primary" style={{ fontSize: "0.8rem", padding: "0.35rem 0.9rem" }}
                    onClick={() => { onUseIdea(s); onClose(); }}>
                    Use this idea →
                  </button>
                  <button className="btn btn-outline" style={{ fontSize: "0.8rem", padding: "0.35rem 0.9rem" }}
                    onClick={() => dismiss(s.id)}>
                    Dismiss
                  </button>
                  <button className="btn-icon-danger" onClick={() => deleteSuggestion(s.id)} title="Delete">
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
