"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { ClusterMoniker } from "../lib/solana-client";
import { CLUSTERS } from "../lib/solana-client";
import { getExplorerUrl } from "../lib/explorer";

type ClusterContextValue = {
  cluster: ClusterMoniker;
  setCluster: (cluster: ClusterMoniker) => void;
  getExplorerUrl: (path: string) => string;
};

const ClusterContext = createContext<ClusterContextValue | null>(null);

const STORAGE_KEY = "solana-cluster";
/** When NEXT_PUBLIC_SOLANA_NETWORK changes (e.g. localnet→devnet), reset stale localStorage. */
const CLUSTER_ENV_SNAPSHOT_KEY = "solana-cluster-env-snapshot";

function getEnvDefaultCluster(): ClusterMoniker {
  const envValue = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (envValue && CLUSTERS.includes(envValue as ClusterMoniker)) {
    return envValue as ClusterMoniker;
  }
  return "devnet";
}

function getInitialCluster(): ClusterMoniker {
  const envDefault = getEnvDefaultCluster();
  if (typeof window === "undefined") return envDefault;

  const snapshot =
    typeof process.env.NEXT_PUBLIC_SOLANA_NETWORK === "string"
      ? process.env.NEXT_PUBLIC_SOLANA_NETWORK
      : "";
  const prevSnapshot = localStorage.getItem(CLUSTER_ENV_SNAPSHOT_KEY);
  if (prevSnapshot !== snapshot) {
    localStorage.setItem(CLUSTER_ENV_SNAPSHOT_KEY, snapshot);
    localStorage.setItem(STORAGE_KEY, envDefault);
    return envDefault;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && CLUSTERS.includes(stored as ClusterMoniker)) {
    return stored as ClusterMoniker;
  }
  return envDefault;
}

export { CLUSTERS };

export function ClusterProvider({ children }: { children: ReactNode }) {
  const [cluster, setClusterState] =
    useState<ClusterMoniker>(getInitialCluster);

  const setCluster = useCallback((c: ClusterMoniker) => {
    setClusterState(c);
    localStorage.setItem(STORAGE_KEY, c);
  }, []);

  const explorerUrl = useCallback(
    (path: string) => getExplorerUrl(path, cluster),
    [cluster]
  );

  return (
    <ClusterContext.Provider
      value={{ cluster, setCluster, getExplorerUrl: explorerUrl }}
    >
      {children}
    </ClusterContext.Provider>
  );
}

export function useCluster() {
  const ctx = useContext(ClusterContext);
  if (!ctx) throw new Error("useCluster must be used within ClusterProvider");
  return ctx;
}
