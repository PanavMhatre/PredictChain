"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAllMarkets, getReadContract, MarketData } from "../lib/contract";
import { MarketCard } from "../components/MarketCard";
import { WalletStats } from "../components/WalletStats";
import { CreateMarketModal } from "../components/CreateMarketModal";
import { SuggestMarketModal } from "../components/SuggestMarketModal";
import { SuggestionsPanel } from "../components/SuggestionsPanel";
import { useMarketEvents } from "../lib/useMarketEvents";
import { useWallet } from "../lib/WalletContext";
import type { Suggestion } from "./api/suggestions/route";

export default function Home() {
  const { address } = useWallet();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [prefill, setPrefill] = useState<Suggestion | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchAllMarkets();
      setMarkets(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useMarketEvents(load);

  // Check owner
  useEffect(() => {
    if (!address) { setIsOwner(false); return; }
    try {
      const contract = getReadContract();
      contract.owner().then((owner: string) => {
        setIsOwner(owner.toLowerCase() === address.toLowerCase());
      }).catch(() => setIsOwner(false));
    } catch {
      setIsOwner(false);
    }
  }, [address]);

  // Poll pending suggestions count for owner badge
  useEffect(() => {
    if (!isOwner) return;
    async function fetchCount() {
      try {
        const res = await fetch("/api/suggestions");
        const data: Suggestion[] = await res.json();
        setPendingCount(data.filter((s) => s.status === "pending").length);
      } catch { /* ignore */ }
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [isOwner]);

  function handleUseIdea(s: Suggestion) {
    setPrefill(s);
    setShowCreate(true);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Prediction Markets</h1>
          <p className="page-subtitle">Stake ETH on outcomes. Winners split the pool.</p>
        </div>
        <div className="page-header-right">
          {isOwner ? (
            <>
              <button className="btn btn-outline btn-suggestions" onClick={() => setShowSuggestions(true)}>
                Suggestions
                {pendingCount > 0 && <span className="suggestions-badge">{pendingCount}</span>}
              </button>
              <button className="btn btn-primary btn-create" onClick={() => { setPrefill(null); setShowCreate(true); }}>
                + New Market
              </button>
            </>
          ) : address ? (
            <button className="btn btn-outline btn-create" onClick={() => setShowSuggest(true)}>
              + Suggest Market
            </button>
          ) : null}
          <WalletStats markets={markets} />
        </div>
      </div>

      {showCreate && (
        <CreateMarketModal
          prefill={prefill}
          onClose={() => setShowCreate(false)}
          onSuccess={load}
        />
      )}
      {showSuggest && <SuggestMarketModal onClose={() => setShowSuggest(false)} />}
      {showSuggestions && (
        <SuggestionsPanel
          onClose={() => setShowSuggestions(false)}
          onUseIdea={handleUseIdea}
        />
      )}

      {loading && <p className="loading-text">Loading markets…</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && markets.length === 0 && (
        <p className="empty-text">No markets found. Deploy the contract and seed some markets first.</p>
      )}

      <div className="market-grid">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </div>
  );
}
