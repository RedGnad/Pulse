"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type NetworkMode = "testnet" | "mainnet";

interface NetworkContextValue {
  network: NetworkMode;
  toggle: () => void;
  isMainnet: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  network: "testnet",
  toggle: () => {},
  isMainnet: false,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<NetworkMode>("testnet");

  // Restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pulse-network");
    if (saved === "mainnet" || saved === "testnet") setNetwork(saved);
  }, []);

  const toggle = useCallback(() => {
    setNetwork(prev => {
      const next = prev === "testnet" ? "mainnet" : "testnet";
      localStorage.setItem("pulse-network", next);
      return next;
    });
  }, []);

  return (
    <NetworkContext.Provider value={{ network, toggle, isMainnet: network === "mainnet" }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
