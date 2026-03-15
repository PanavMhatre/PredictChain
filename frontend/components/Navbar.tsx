"use client";

import Link from "next/link";
import { WalletConnect } from "./WalletConnect";

export function Navbar() {
  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand">
        PredictChain
      </Link>
      <WalletConnect />
    </nav>
  );
}
