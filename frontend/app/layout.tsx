import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "../lib/WalletContext";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "PredictChain",
  description: "Decentralized prediction markets on Ethereum",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Navbar />
          <main className="main-content">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
