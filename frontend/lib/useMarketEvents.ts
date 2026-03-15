"use client";

import { useEffect } from "react";
import { ethers } from "ethers";
import { getReadContract } from "./contract";

export function useMarketEvents(onUpdate: () => void) {
  useEffect(() => {
    const contract = getReadContract();

    const handleVoted = () => onUpdate();
    const handleResolved = () => onUpdate();
    const handleClaimed = () => onUpdate();

    contract.on("Voted", handleVoted);
    contract.on("MarketResolved", handleResolved);
    contract.on("RewardClaimed", handleClaimed);

    return () => {
      contract.off("Voted", handleVoted);
      contract.off("MarketResolved", handleResolved);
      contract.off("RewardClaimed", handleClaimed);
    };
  }, [onUpdate]);
}
