"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { WalletButton } from "./wallet-button";
import { useWallet } from "../lib/wallet/context";
import { isAdminWallet } from "../lib/admin";

const NAV_LINKS = [
  { href: "/borrow", label: "Borrow" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/lend", label: "Lend" },
];

export function Navbar() {
  const pathname = usePathname();
  const { wallet } = useWallet();
  const isAdmin = isAdminWallet(wallet?.account.address);
  const links = isAdmin
    ? [...NAV_LINKS, { href: "/admin", label: "Admin" }]
    : NAV_LINKS;

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-[color-mix(in_srgb,var(--card)_92%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5 md:py-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-foreground no-underline"
          aria-label="Saathi Loan home"
        >
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10">
            <Image
              src="/brand-logo.png"
              alt=""
              aria-hidden
              width={36}
              height={36}
              className="h-9 w-9 object-cover"
              priority
            />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Saathi Loan
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
                {active ? (
                  <span className="absolute bottom-1 left-4 right-4 h-0.5 rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="hidden rounded-full border border-border/80 p-2 text-muted-foreground sm:inline-flex"
            title="Self-custody"
            aria-hidden
          >
            <Shield className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <WalletButton
            disconnectedLabel="Connect Wallet"
            className="h-auto! rounded-full! border-0! bg-primary! px-5! py-2.5! text-sm! font-semibold! text-primary-foreground! shadow-none! hover:bg-primary/90!"
          />
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex border-t border-border/60 px-4 pb-3 pt-2 md:hidden">
        <div className="flex w-full justify-center gap-1 overflow-x-auto">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
