"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../lib/WalletContext";
import { getReadProvider } from "../lib/contract";

export function WalletConnect() {
  const { address, connect, disconnect, isConnecting, chainOk } = useWallet();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!address) { setBalance(null); return; }
    getReadProvider()
      .getBalance(address)
      .then((b) => setBalance(Number(ethers.formatEther(b)).toFixed(3)))
      .catch(() => setBalance(null));
  }, [address]);

  if (address) {
    return (
      <div className="wallet-info">
        <span className={`chain-badge ${chainOk ? "ok" : "bad"}`}>
          {chainOk ? "✓" : "⚠ Wrong network"}
        </span>
        {balance !== null && (
          <span className="navbar-balance">{balance} ETH</span>
        )}
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
