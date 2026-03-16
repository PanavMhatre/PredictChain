"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAllMarkets, getReadContract, MarketData } from "../lib/contract";
import { MarketCard } from "../components/MarketCard";
import { WalletStats } from "../components/WalletStats";
import { CreateMarketModal } from "../components/CreateMarketModal";
import { useMarketEvents } from "../lib/useMarketEvents";
import { useWallet } from "../lib/WalletContext";

export default function Home() {
  const { address } = useWallet();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

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

  // Check if connected wallet is the contract owner
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Prediction Markets</h1>
          <p className="page-subtitle">Stake ETH on outcomes. Winners split the pool.</p>
        </div>
        <div className="page-header-right">
          <WalletStats markets={markets} />
          {isOwner && (
            <button className="btn btn-primary btn-create" onClick={() => setShowCreate(true)}>
              + New Market
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateMarketModal
          onClose={() => setShowCreate(false)}
          onSuccess={load}
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
