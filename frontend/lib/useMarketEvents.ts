"use client";

import { useEffect, useRef } from "react";
import { getReadProvider } from "./contract";

// Polls for new blocks every 12 seconds (≈ Sepolia block time).
// Works with plain HTTP RPC endpoints (no WebSocket needed).
// On local Hardhat it fires immediately on any new block.
export function useMarketEvents(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let destroyed = false;
    const provider = getReadProvider();

    function handleBlock() {
      if (!destroyed) onUpdateRef.current();
    }

    provider.on("block", handleBlock);

    return () => {
      destroyed = true;
      provider.off("block", handleBlock);
      provider.destroy();
    };
  }, []);
}
