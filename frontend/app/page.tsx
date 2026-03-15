"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAllMarkets, MarketData } from "../lib/contract";
import { MarketCard } from "../components/MarketCard";
import { WalletStats } from "../components/WalletStats";
import { useMarketEvents } from "../lib/useMarketEvents";

export default function Home() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Prediction Markets</h1>
          <p className="page-subtitle">Stake ETH on outcomes. Winners split the pool.</p>
        </div>
        <WalletStats markets={markets} />
      </div>

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
