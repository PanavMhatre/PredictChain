"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWallet } from "../lib/WalletContext";
import { getReadProvider, getReadContract, MarketData } from "../lib/contract";

interface Props {
  markets: MarketData[];
}

export function WalletStats({ markets }: Props) {
  const { address } = useWallet();
  const [balance, setBalance] = useState<string | null>(null);
  const [totalStaked, setTotalStaked] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    async function load() {
      if (!address) return;
      try {
        const provider = getReadProvider();
        const contract = getReadContract();

        const bal = await provider.getBalance(address);
        setBalance(Number(ethers.formatEther(bal)).toFixed(4));

        let staked = 0n;
        for (const market of markets) {
          for (let i = 0; i < market.options.length; i++) {
            const s: bigint = await contract.getUserStake(market.id, i, address);
            staked += s;
          }
        }
        setTotalStaked(Number(ethers.formatEther(staked)).toFixed(4));
      } catch {
        // silently fail — wallet may not be on correct network yet
      }
    }

    load();
  }, [address, markets]);

  if (!address) return null;

  return (
    <div className="wallet-stats">
      <div className="wallet-stat-card">
        <span className="wallet-stat-label">Your Balance</span>
        <span className="wallet-stat-value">
          {balance ?? "…"} <span className="wallet-stat-unit">ETH</span>
        </span>
      </div>
      <div className="wallet-stat-card">
        <span className="wallet-stat-label">Total Staked</span>
        <span className="wallet-stat-value">
          {totalStaked ?? "…"} <span className="wallet-stat-unit">ETH</span>
        </span>
      </div>
    </div>
  );
}
