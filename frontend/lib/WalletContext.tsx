"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ethers } from "ethers";
import { CHAIN_ID } from "./contract";

interface WalletContextType {
  address: string | null;
  signer: ethers.Signer | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  chainOk: boolean;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  signer: null,
  connect: async () => {},
  disconnect: () => {},
  isConnecting: false,
  chainOk: false,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chainOk, setChainOk] = useState(false);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !(window as Window & { ethereum?: unknown }).ethereum) {
      alert("MetaMask not found. Please install it.");
      return;
    }
    setIsConnecting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      const ok = Number(network.chainId) === CHAIN_ID;
      setChainOk(ok);
      if (!ok) {
        alert(
          `Wrong network! Please switch MetaMask to chain ID ${CHAIN_ID}.`
        );
      }
      const s = await provider.getSigner();
      setSigner(s);
      setAddress(await s.getAddress());
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setChainOk(false);
  }, []);

  return (
    <WalletContext.Provider value={{ address, signer, connect, disconnect, isConnecting, chainOk }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
