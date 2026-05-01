"use client";

import Link from "next/link";
import Image from "next/image";
import { Navbar } from "./components/navbar";
import { WalletButton } from "./components/wallet-button";
import { useWallet } from "./lib/wallet/context";

const STATS = [
  { value: "30+", label: "On-Chain Signals", sub: "analyzed per wallet scan" },
  { value: "<5s", label: "Time to Funds", sub: "from approval to wallet" },
  { value: "0 KYC", label: "Zero Paperwork", sub: "your history is the form" },
];

const PILLARS = [
  {
    icon: "◆",
    num: "01",
    title: "Risk Scoring",
    description:
      "We read your Solana history — not your bank statement. Thirty-plus on-chain signals combine into a single borrow limit and rate. No forms. No bureaus. No waiting.",
    bullets: ["Wallet age & activity depth", "Prior repayment history", "Current collateral ratios"],
  },
  {
    icon: "▣",
    num: "02",
    title: "Vault Collateral",
    description:
      "Lock SOL or SPL tokens in a deterministic program vault. Liquidation triggers are code, not policy — every rule is visible on-chain before you sign.",
    bullets: ["SOL + SPL token support", "Transparent auto-liquidation", "Real-time LTV monitoring"],
  },
  {
    icon: "◈",
    num: "03",
    title: "Liquidity Pools",
    description:
      "Lenders deposit into shared pools and earn yield. Borrowers draw instantly. One pool, no intermediary capturing the spread.",
    bullets: ["Dynamic APY for depositors", "Instant borrow drawdowns", "Protocol-level accounting"],
  },
  {
    icon: "⬡",
    num: "04",
    title: "On-Chain Credit",
    description:
      "Every repayment writes to your permanent Solana record. Consistent borrowers earn lower rates over time — a permissionless credit history you actually own.",
    bullets: ["Persistent credit record", "Rate improvement path", "Fully portable across dApps"],
  },
];

const STEPS = [
  {
    num: "01",
    label: "CONNECT",
    title: "Link your wallet",
    desc: "Any Solana-standard wallet. We pull your on-chain history — no email, no form, no account.",
  },
  {
    num: "02",
    label: "SCORE",
    title: "See your limit",
    desc: "30+ signals scored in seconds. Your history sets the rate — not a credit agency.",
  },
  {
    num: "03",
    label: "VAULT",
    title: "Lock collateral",
    desc: "Collateral goes into a deterministic vault. Rules are transparent code, not hidden clauses.",
  },
  {
    num: "04",
    label: "BORROW",
    title: "Funds hit your wallet",
    desc: "Confirmed in the same transaction. Repay any time and watch your score improve.",
  },
];

const sp = "var(--font-space), system-ui, sans-serif";
const lo = "var(--font-lora), Georgia, serif";
const cream = "#fdf5e8";
const creamDark = "#f5e8d2";
const red = "#e53935";
const dark = "#1a0a00";
const brown = "#6a4a35";
const textBrown = "#4a3020";
const border = "1px solid rgba(0,0,0,0.09)";
const card = "rgba(255,255,255,0.72)";

export default function HomePage() {
  const { status } = useWallet();
  const connected = status === "connected";

  return (
    <div style={{ backgroundColor: cream, minHeight: "100vh", color: dark, fontFamily: sp }}>
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ position: "relative", overflow: "hidden", minHeight: "100vh" }}>
        {/* Content — transparent over art; light type + shadow for readability */}
        <div
          style={{
            maxWidth: 820,
            margin: "0 auto",
            padding: "80px 24px 48px",
            textAlign: "center",
            position: "relative",
            zIndex: 3,
          }}
        >
          <p
            style={{
              display: "inline-flex",
              border: "1px solid rgba(255,255,255,0.45)",
              padding: "6px 16px",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginBottom: 28,
              backgroundColor: "rgba(0,0,0,0.4)",
              color: "#fffef9",
              fontFamily: sp,
              fontWeight: 600,
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}
          >
            ■ SOLANA DEVNET · DECENTRALIZED LENDING
          </p>

          <h1
            style={{
              fontFamily: sp,
              fontSize: "clamp(38px, 6.5vw, 76px)",
              fontWeight: 800,
              lineHeight: 1.03,
              letterSpacing: "-0.03em",
              marginBottom: 8,
              color: "#fffef9",
              textShadow:
                "0 2px 4px rgba(0,0,0,0.85), 0 1px 14px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,1)",
            }}
          >
            Your wallet is
            <br />
            the credit check.
          </h1>
          <h1
            style={{
              fontFamily: lo,
              fontSize: "clamp(32px, 5.5vw, 64px)",
              fontWeight: 600,
              fontStyle: "italic",
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: red,
              marginBottom: 24,
              textShadow:
                "0 2px 6px rgba(0,0,0,0.85), 0 0 20px rgba(0,0,0,0.4)",
            }}
          >
            Borrow instantly on Solana.
          </h1>

          <p
            style={{
              maxWidth: 460,
              margin: "0 auto 36px",
              fontSize: 17,
              color: "rgba(255, 252, 248, 0.98)",
              lineHeight: 1.65,
              fontFamily: sp,
              fontWeight: 600,
              textShadow:
                "0 1px 3px rgba(0,0,0,0.9), 0 2px 14px rgba(0,0,0,0.55)",
            }}
          >
            SolLend scores your on-chain history across 30+ signals and gives
            you a loan in seconds. No forms, no banks, no friction.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            {connected ? (
              <Link
                href="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 52,
                  padding: "0 34px",
                  backgroundColor: red,
                  color: "#fffef9",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: sp,
                  letterSpacing: "0.02em",
                  border: "2px solid #b71c1c",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 16px rgba(183, 28, 28, 0.35)",
                }}
              >
                Open Dashboard →
              </Link>
            ) : (
              <WalletButton
                disconnectedLabel="Connect Wallet →"
                className="!h-[52px] !rounded-none !border-2 !border-[#b71c1c] !bg-[#e53935] !px-8 !text-sm !font-bold !text-[#fffef9] !shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_rgba(183,28,28,0.35)] !ring-0"
              />
            )}
            <Link
              href="/borrow"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 52,
                padding: "0 30px",
                backgroundColor: "rgba(253, 245, 232, 0.95)",
                border: `2px solid ${brown}`,
                color: red,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: sp,
                letterSpacing: "0.02em",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.65), 0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              See how borrowing works
            </Link>
          </div>

          <p
            style={{
              fontSize: 10,
              color: "#fffef9",
              fontFamily: sp,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
            }}
          >
            FREE SCORE — NO CARD REQUIRED
          </p>
        </div>

        {/* Pixel art hero — full bleed; contain + bottom so the whole asset shows on wide/desktop viewports */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          <Image
            src="/pixel-hero.png"
            alt="SolLend pixel art landscape"
            fill
            priority
            sizes="100vw"
            style={{
              objectFit: "contain",
              objectPosition: "center bottom",
            }}
          />
          {/* Light blend under nav only — hero copy sits on the art */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "clamp(100px, 22vh, 240px)",
              background: `linear-gradient(to bottom, ${cream} 0%, transparent 100%)`,
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section style={{ backgroundColor: creamDark, borderTop: border, borderBottom: border }}>
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
          }}
        >
          {STATS.map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: "38px 32px",
                borderRight: i < STATS.length - 1 ? border : "none",
              }}
            >
              <p
                style={{
                  fontSize: 46,
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  fontFamily: sp,
                }}
              >
                {s.value}
              </p>
              <p
                style={{
                  color: red,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginTop: 6,
                  fontFamily: sp,
                }}
              >
                {s.label}
              </p>
              <p style={{ color: brown, fontSize: 12, marginTop: 4, fontFamily: sp }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOUR PILLARS ─────────────────────────────────────── */}
      <section style={{ padding: "88px 24px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <p
              style={{
                display: "inline-flex",
                border,
                padding: "4px 14px",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                marginBottom: 20,
                color: brown,
                fontFamily: sp,
              }}
            >
              FOUR PILLARS · ONE PROTOCOL
            </p>
            <h2
              style={{
                fontFamily: sp,
                fontSize: "clamp(26px, 4vw, 50px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.06,
                marginBottom: 6,
              }}
            >
              One protocol for
            </h2>
            <h2
              style={{
                fontFamily: lo,
                fontSize: "clamp(24px, 3.8vw, 46px)",
                fontWeight: 600,
                fontStyle: "italic",
                color: red,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
                marginBottom: 20,
              }}
            >
              how DeFi lending actually works.
            </h2>
            <p
              style={{
                maxWidth: 540,
                margin: "0 auto",
                color: textBrown,
                fontSize: 15,
                lineHeight: 1.7,
                fontFamily: sp,
              }}
            >
              Lending is no longer just smart contracts and APY. SolLend
              scores, vaults, and disburses across every on-chain signal —
              without you jumping between three dashboards.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {PILLARS.map((p) => (
              <div
                key={p.title}
                style={{ backgroundColor: card, padding: "34px 30px", border }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: red,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {p.icon}
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        color: brown,
                        textTransform: "uppercase",
                        fontFamily: sp,
                      }}
                    >
                      PILLAR · {p.num}
                    </p>
                    <h3
                      style={{
                        fontFamily: sp,
                        fontSize: 22,
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                      }}
                    >
                      {p.title}
                    </h3>
                  </div>
                </div>
                <p
                  style={{
                    color: textBrown,
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    marginBottom: 18,
                    fontFamily: sp,
                  }}
                >
                  {p.description}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                  {p.bullets.map((b) => (
                    <li
                      key={b}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        fontSize: 12.5,
                        color: textBrown,
                        fontFamily: sp,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor: red,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THE LOOP ─────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px",
          backgroundColor: creamDark,
          borderTop: border,
          borderBottom: border,
        }}
      >
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p
              style={{
                display: "inline-flex",
                border,
                padding: "4px 14px",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                marginBottom: 20,
                color: brown,
                fontFamily: sp,
              }}
            >
              THE LOOP
            </p>
            <h2
              style={{
                fontFamily: sp,
                fontSize: "clamp(26px, 4vw, 48px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.06,
                marginBottom: 6,
              }}
            >
              Wallet to funded —
            </h2>
            <h2
              style={{
                fontFamily: lo,
                fontSize: "clamp(24px, 3.5vw, 44px)",
                fontWeight: 600,
                fontStyle: "italic",
                color: red,
                letterSpacing: "-0.01em",
                lineHeight: 1.1,
              }}
            >
              in four steps.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {STEPS.map((s) => (
              <div
                key={s.num}
                style={{ backgroundColor: card, padding: "28px 22px", border }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <p
                    style={{
                      fontFamily: sp,
                      fontSize: 40,
                      fontWeight: 800,
                      color: red,
                      lineHeight: 1,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {s.num}
                  </p>
                  <p
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.18em",
                      border,
                      padding: "2px 6px",
                      color: brown,
                      textTransform: "uppercase",
                      fontFamily: sp,
                    }}
                  >
                    {s.label}
                  </p>
                </div>
                <h3
                  style={{
                    fontFamily: sp,
                    fontWeight: 700,
                    fontSize: 14.5,
                    marginBottom: 8,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ color: textBrown, fontSize: 12.5, lineHeight: 1.65, fontFamily: sp }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────── */}
      <section style={{ padding: "48px 24px 80px" }}>
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            backgroundColor: dark,
            padding: "72px 48px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              display: "inline-flex",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "4px 14px",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 24,
              fontFamily: sp,
            }}
          >
            ■ GET YOUR SCORE — NO CARD NEEDED
          </p>
          <h2
            style={{
              fontFamily: sp,
              fontSize: "clamp(26px, 4vw, 50px)",
              fontWeight: 800,
              color: "white",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              marginBottom: 8,
            }}
          >
            Five seconds from wallet
          </h2>
          <h2
            style={{
              fontFamily: lo,
              fontSize: "clamp(24px, 3.5vw, 46px)",
              fontWeight: 600,
              fontStyle: "italic",
              color: red,
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            to funded loan.
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.58)",
              maxWidth: 440,
              margin: "0 auto 40px",
              fontSize: 15,
              lineHeight: 1.7,
              fontFamily: sp,
            }}
          >
            Connect, get scored, and borrow — all in one flow. No sign-up
            form. No waiting room. No middleman.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            {connected ? (
              <Link
                href="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 50,
                  padding: "0 32px",
                  backgroundColor: red,
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: sp,
                }}
              >
                Open Dashboard →
              </Link>
            ) : (
              <WalletButton
                disconnectedLabel="Connect Wallet →"
                className="!rounded-none !bg-[#e53935] !text-white !font-bold !text-sm !h-[50px] !px-8"
              />
            )}
            <Link
              href="/borrow"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 50,
                padding: "0 28px",
                color: "rgba(255,255,255,0.65)",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: sp,
              }}
            >
              See the borrow flow
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{ backgroundColor: "#100500", padding: "52px 24px", color: "rgba(255,255,255,0.5)" }}>
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            gap: 40,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: red,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 11,
                  fontFamily: sp,
                }}
              >
                SL
              </div>
              <div>
                <p style={{ color: "white", fontWeight: 700, fontSize: 14, fontFamily: sp, letterSpacing: "-0.01em" }}>
                  sollend
                </p>
                <p style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: red, fontFamily: sp }}>
                  / ON-CHAIN LENDING
                </p>
              </div>
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.7, maxWidth: 240, fontFamily: sp }}>
              Score, vault, and borrow on Solana. Built for wallets that move
              fast and borrowers who earn their rate.
            </p>
          </div>

          <div>
            <p
              style={{
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: 16,
                color: "rgba(255,255,255,0.35)",
                fontFamily: sp,
              }}
            >
              PROTOCOL
            </p>
            {[
              { label: "Borrow", href: "/borrow" },
              { label: "Dashboard", href: "/dashboard" },
              { label: "Lend", href: "/lend" },
            ].map((l) => (
              <p key={l.label} style={{ fontSize: 13, marginBottom: 9, fontFamily: sp }}>
                <Link
                  href={l.href}
                  style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}
                >
                  {l.label}
                </Link>
              </p>
            ))}
          </div>

          <div>
            <p
              style={{
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: 16,
                color: "rgba(255,255,255,0.35)",
                fontFamily: sp,
              }}
            >
              NETWORK
            </p>
            <p style={{ fontSize: 13, marginBottom: 9, fontFamily: sp }}>Solana Devnet</p>
            <p style={{ fontSize: 13, marginBottom: 9, color: "rgba(255,255,255,0.3)", fontFamily: sp }}>
              Mainnet — soon
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
