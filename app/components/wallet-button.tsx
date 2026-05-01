"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "../lib/wallet/context";
import { useBalance } from "../lib/hooks/use-balance";
import { lamportsToSolString } from "../lib/lamports";
import { ellipsify } from "../lib/explorer";
import { useCluster } from "./cluster-context";

const WALLET_INSTALL_LINKS = [
  { label: "Phantom", href: "https://phantom.app/download" },
  { label: "Solflare", href: "https://www.solflare.com/download" },
] as const;

type MenuBox = { top: number; right: number; width: number };

type WalletButtonProps = {
  className?: string;
  disconnectedLabel?: string;
};

export function WalletButton({
  className,
  disconnectedLabel = "Connect Wallet",
}: WalletButtonProps) {
  const { connectors, connect, disconnect, wallet, status, error, clearConnectError } =
    useWallet();

  const { getExplorerUrl } = useCluster();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);

  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const address = wallet?.account.address;
  const balance = useBalance(address);

  function updateMenuPosition() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuBox({
      top: r.bottom + 8,
      right: Math.max(8, window.innerWidth - r.right),
      width: Math.max(288, Math.ceil(r.width)),
    });
  }

  const close = () => setIsOpen(false);

  const openMenu = () => {
    clearConnectError();
    setIsOpen(true);
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const onMove = () => updateMenuPosition();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status !== "connected") {
    return (
      <div className="relative" ref={triggerRef}>
        <button
          type="button"
          onClick={() => (isOpen ? close() : openMenu())}
          className={`cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className ?? ""}`}
        >
          {disconnectedLabel}
        </button>

        {isOpen &&
          menuBox &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] rounded-xl border border-border bg-card p-3 shadow-lg"
              style={{
                top: menuBox.top,
                right: menuBox.right,
                width: menuBox.width,
                minWidth: 288,
              }}
            >
              <p className="mb-2 break-words text-xs font-semibold leading-snug text-card-foreground">
                Select a Solana wallet
              </p>
              {connectors.length === 0 ? (
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    No wallet detected. Install an extension, refresh this page,
                    then try again.
                  </p>
                  <ul className="flex flex-col gap-1.5 pt-1">
                    {WALLET_INSTALL_LINKS.map((item) => (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary underline underline-offset-2"
                        >
                          Get {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-1">
                  {connectors.map((connector) => (
                    <button
                      key={connector.id}
                      type="button"
                      onClick={async () => {
                        try {
                          await connect(connector.id);
                          close();
                        } catch {
                          /* errors surfaced in context */
                        }
                      }}
                      disabled={status === "connecting"}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                    >
                      {connector.icon && (
                        <img
                          src={connector.icon}
                          alt=""
                          className="h-5 w-5 shrink-0 rounded"
                        />
                      )}
                      <span className="min-w-0 break-words">{connector.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {status === "connecting" && (
                <p className="mt-2 text-xs text-muted-foreground">Connecting…</p>
              )}
              {error != null && (
                <p className="mt-2 text-xs text-destructive">
                  {error instanceof Error ? error.message : String(error)}
                </p>
              )}
            </div>,
            document.body
          )}
      </div>
    );
  }

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={() => (isOpen ? close() : openMenu())}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border border-border-low bg-card px-3 py-2 text-xs font-medium transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className ?? ""}`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
        <span className="font-mono">{ellipsify(address!, 4)}</span>
      </button>

      {isOpen &&
        menuBox &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-72 max-w-[calc(100vw-16px)] rounded-xl border border-border-low bg-card p-4 shadow-lg"
            style={{
              top: menuBox.top,
              right: menuBox.right,
            }}
          >
            <div className="mb-3">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-lg font-bold tabular-nums">
                {balance.lamports != null
                  ? lamportsToSolString(balance.lamports)
                  : "\u2014"}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  SOL
                </span>
              </p>
            </div>

            <div className="mb-3 rounded-lg border border-border-low bg-cream/50 px-3 py-2">
              <p className="break-all font-mono text-xs">{address}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 cursor-pointer rounded-lg border border-border-low bg-card px-3 py-2 text-xs font-medium transition hover:bg-accent"
              >
                {copied ? "Copied!" : "Copy address"}
              </button>
              <a
                href={getExplorerUrl(`/address/${address}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg border border-border-low bg-card px-3 py-2 text-center text-xs font-medium transition hover:bg-accent"
              >
                Explorer
              </a>
            </div>

            <button
              type="button"
              onClick={() => {
                void disconnect();
                close();
              }}
              className="mt-2 w-full cursor-pointer rounded-lg border border-border-low bg-card px-3 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/10"
            >
              Disconnect
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
