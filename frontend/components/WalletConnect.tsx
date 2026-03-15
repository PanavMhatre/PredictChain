"use client";

import { useWallet } from "../lib/WalletContext";

export function WalletConnect() {
  const { address, connect, disconnect, isConnecting, chainOk } = useWallet();

  if (address) {
    return (
      <div className="wallet-info">
        <span className={`chain-badge ${chainOk ? "ok" : "bad"}`}>
          {chainOk ? "✓" : "⚠ Wrong network"}
        </span>
        <span className="wallet-address">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button className="btn btn-outline" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button className="btn btn-primary" onClick={connect} disabled={isConnecting}>
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
