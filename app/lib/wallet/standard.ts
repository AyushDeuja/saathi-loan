import { getWallets } from "@wallet-standard/app";
import type { Wallet as StandardWallet } from "@wallet-standard/base";
import {
  StandardConnect,
  StandardDisconnect,
  type StandardConnectFeature,
  type StandardDisconnectFeature,
} from "@wallet-standard/features";
import {
  SolanaSignTransaction,
  SolanaSignAndSendTransaction,
  type SolanaSignTransactionFeature,
  type SolanaSignAndSendTransactionFeature,
} from "@solana/wallet-standard-features";
import type { Address } from "@solana/kit";
import type {
  WalletConnector,
  WalletConnectorMetadata,
  WalletSession,
} from "./types";

function isSolanaWallet(wallet: StandardWallet): boolean {
  return (
    StandardConnect in wallet.features &&
    wallet.chains.some((chain) => chain.startsWith("solana:"))
  );
}

function connectorId(wallet: StandardWallet): string {
  const solChains = wallet.chains
    .filter((c) => c.startsWith("solana:"))
    .sort()
    .join("|");
  const ver =
    "version" in wallet && typeof (wallet as { version?: string }).version === "string"
      ? (wallet as { version: string }).version
      : "";
  return `${wallet.name}::${ver}::${solChains}`;
}

function createConnector(wallet: StandardWallet): WalletConnector {
  const id = connectorId(wallet);
  const metadata: WalletConnectorMetadata = {
    id,
    name: wallet.name,
    icon: wallet.icon,
  };

  return {
    ...metadata,
    connect: async (options) => {
      const connectFeature = wallet.features[
        StandardConnect
      ] as StandardConnectFeature[typeof StandardConnect];
      const { accounts } = await connectFeature.connect(
        options?.silent ? { silent: true } : undefined
      );

      const account = accounts[0] ?? wallet.accounts[0];
      if (!account) throw new Error("No accounts available");

      const walletAccount = {
        address: account.address as Address,
        publicKey: new Uint8Array(account.publicKey),
        label: account.label,
      };

      const hasSendTx = SolanaSignAndSendTransaction in wallet.features;
      const hasSignTx = SolanaSignTransaction in wallet.features;

      const session: WalletSession = {
        account: walletAccount,
        connector: metadata,
        disconnect: async () => {
          if (StandardDisconnect in wallet.features) {
            const feature = wallet.features[
              StandardDisconnect
            ] as StandardDisconnectFeature[typeof StandardDisconnect];
            await feature.disconnect();
          }
        },
        signTransaction: hasSignTx
          ? async (transaction: Uint8Array, chain: string) => {
              const feature = wallet.features[
                SolanaSignTransaction
              ] as SolanaSignTransactionFeature[typeof SolanaSignTransaction];
              const [result] = await feature.signTransaction({
                account,
                transaction,
                chain: chain as `${string}:${string}`,
              });
              return new Uint8Array(result.signedTransaction);
            }
          : undefined,
        sendTransaction: hasSendTx
          ? async (transaction: Uint8Array, chain: string) => {
              const feature = wallet.features[
                SolanaSignAndSendTransaction
              ] as SolanaSignAndSendTransactionFeature[typeof SolanaSignAndSendTransaction];
              const [result] = await feature.signAndSendTransaction({
                account,
                transaction,
                chain: chain as `${string}:${string}`,
              });
              return new Uint8Array(result.signature);
            }
          : undefined,
      };

      return session;
    },
  };
}

export function discoverWallets(): WalletConnector[] {
  const { get } = getWallets();
  return get().filter(isSolanaWallet).map(createConnector);
}

export function watchWallets(
  onChange: (connectors: WalletConnector[]) => void
): () => void {
  const wallets = getWallets();

  function update() {
    onChange(wallets.get().filter(isSolanaWallet).map(createConnector));
  }

  const offRegister = wallets.on("register", update);
  const offUnregister = wallets.on("unregister", update);

  return () => {
    offRegister();
    offUnregister();
  };
}
