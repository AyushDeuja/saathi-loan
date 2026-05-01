"use client";

import { ThemeProvider } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";
import { PropsWithChildren, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as HotToaster } from "react-hot-toast";
import { ClusterProvider } from "./cluster-context";
import { WalletProvider } from "../lib/wallet/context";
import { SolanaClientProvider } from "../lib/solana-client-context";

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <ClusterProvider>
          <SolanaClientProvider>
            <WalletProvider>{children}</WalletProvider>
          </SolanaClientProvider>
          <SonnerToaster position="bottom-right" richColors />
          <HotToaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "var(--color-card)",
                color: "var(--color-foreground)",
                border: "1px solid var(--color-border)",
              },
            }}
          />
        </ClusterProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
