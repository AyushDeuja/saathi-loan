"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "16px 20px",
        background: "transparent",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(0,0,0,0.1)",
          padding: "10px 18px",
          pointerEvents: "auto",
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          aria-label="SolLend home"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <Image
            src="/brand-logo.png"
            alt=""
            width={44}
            height={44}
            priority
            unoptimized
            sizes="44px"
            style={{
              flexShrink: 0,
              width: 44,
              height: 44,
              imageRendering: "pixelated",
            }}
          />
          <div>
            <p
              style={{
                fontFamily: "var(--font-space), sans-serif",
                fontWeight: 700,
                fontSize: 15,
                color: "#1a0a00",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              sollend
            </p>
            <p
              style={{
                fontFamily: "var(--font-space), sans-serif",
                fontSize: 8,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#9a7a65",
                lineHeight: 1,
              }}
            >
              ON-CHAIN LENDING
            </p>
          </div>
        </Link>

        {/* Nav links */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  fontFamily: "var(--font-space), sans-serif",
                  color: active ? "#1a0a00" : "#6a5040",
                  textDecoration: "none",
                  backgroundColor: active ? "rgba(0,0,0,0.06)" : "transparent",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <WalletButton
          disconnectedLabel="Connect Wallet →"
          className="!rounded-none !bg-[#e53935] !text-white !font-semibold !text-xs !px-4 !py-2 !h-auto !shadow-none"
        />
      </div>
    </header>
  );
}
