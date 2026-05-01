# SolLend — Decentralized Loan Platform on Solana

> A peer-to-pool micro-lending DApp built on Solana blockchain. Borrowers connect their Phantom wallet, get a risk score based on on-chain activity, lock SOL as collateral, and receive a SOL loan — all governed by an Anchor smart contract with no intermediaries.

## Current Status

- Phase 1 is complete: the Anchor loan protocol is implemented and tested on localnet.
- Phase 2 is complete: the backend risk scoring and loan routes are live.
- Phase 3 is complete: the landing, borrow, and dashboard flows are in place.
- Phase 4 has started: the lender page and pool helpers exist, but the backend pool stats/activity routes are still pending.
- Phase 5 has not started: Devnet deployment, pool initialization, and final polish are still outstanding.

**Quick env setup:** copy [`.env.example`](.env.example) → `.env.local` at the repo root, and [`backend/.env.example`](backend/.env.example) → `backend/.env`.

**Known limitation:** loan repay in the dashboard uses PDA metadata cached in **browser localStorage** after a borrow. Repay from the **same browser** where you created the loan; clearing site data removes that cache.

**CI (optional):** GitHub Actions workflow template lives in [`docs/github-ci.yml.example`](docs/github-ci.yml.example). Copy it to `.github/workflows/ci.yml`. If `git push` is rejected for “workflow scope”, run `gh auth refresh -s workflow` and push again (or add the workflow in the GitHub UI).

---

## Table of Contents

2. [Project Overview](#project-overview)
3. [System Architecture](#system-architecture)
4. [Tech Stack](#tech-stack)
5. [Repository Structure](#repository-structure)
6. [Smart Contract Design](#smart-contract-design)
7. [Risk Scoring Algorithm](#risk-scoring-algorithm)
8. [Loan Lifecycle](#loan-lifecycle)
9. [Prerequisites](#prerequisites)
10. [Installation & Setup](#installation--setup)
11. [Environment Variables](#environment-variables)
12. [Running the Project](#running-the-project)
13. [Deployment (Devnet)](#deployment-devnet)
14. [API Reference](#api-reference)
15. [Roadmap](#roadmap)
16. [Contributing](#contributing)

---

| Property           | Details                                                 |
| ------------------ | ------------------------------------------------------- |
| Identity           | Phantom wallet public key — no username/password        |
| Loan logic         | On-chain Anchor program — no bank or middleman          |
| Collateral custody | Program Derived Address (PDA) — no one holds your funds |
| Repayment          | On-chain transaction — auto-releases collateral         |
| Liquidation        | Triggered by smart contract — no human intervention     |
| Loan records       | Stored on Solana ledger — immutable and public          |

The backend API exists only to run the risk scoring calculation and relay signed transactions. It holds no funds and cannot move anyone's SOL — only the Anchor program can do that, and only when the borrower signs.

---

## Project Overview

SolLend solves micro-lending for users who have on-chain history but no traditional credit score. The protocol:

- Reads a borrower's wallet history (age, volume, balance, repayment record) to compute a **risk score (0–100)**
- Sets loan terms (interest rate, LTV ratio, duration) based on that score
- Locks **SOL collateral** in a smart-contract vault (PDA)
- Disburses the **loan in SOL** directly to the borrower's wallet
- Automatically releases collateral on full repayment, or liquidates on default

The MVP targets **Solana Devnet** for the hackathon and is designed to go Mainnet-ready with minimal changes.

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React / Next.js)              │
│   Loan form · Dashboard · Repayment · Wallet UI     │
└────────────┬───────────────────────┬────────────────┘
             │ wallet-adapter         │ HTTP
             ▼                        ▼
┌────────────────────┐   ┌───────────────────────────┐
│   Phantom Wallet   │   │    Backend API (Node.js)   │
│  Sign transactions │   │  Loan orchestration        │
│  Read public key   │   │  Risk score calculation    │
│  Read SOL balance  │   │  Loan state management     │
└────────┬───────────┘   └──────────┬────────────────┘
         │ signed tx                 │ approved terms
         ▼                           ▼
┌─────────────────────────────────────────────────────┐
│           Anchor Smart Contract (Rust)              │
│  • create_loan  • repay_loan  • liquidate_loan      │
│  • deposit_pool • withdraw_pool                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│         Liquidity Pool PDA (Program Account)        │
│   Lenders deposit SOL → earns interest              │
│   Pool funds all approved loans                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│           Solana Blockchain (Devnet / Mainnet)       │
│   ~400ms finality · ~$0.00025/tx · Immutable logs  │
└─────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Frontend** — User-facing React app. Connects Phantom wallet, submits loan requests, shows loan status and repayment schedule. Uses `@solana/wallet-adapter-react` to read wallet state and sign transactions.

**Phantom Wallet** — The borrower's identity and signing authority. No private keys ever leave the browser. The wallet adapter reads the public key and SOL balance, and prompts the user to sign each transaction.

**Backend API** — Stateless Node.js service. Accepts a wallet address, fetches on-chain history via Solana RPC, computes the risk score, and returns approved loan terms. Also stores loan metadata in a database (for the dashboard UI).

**Risk Scoring Engine** — A module inside the backend. Pulls wallet data from Solana RPC and scores the address 0–100. Score maps to loan LTV and interest rate.

**Anchor Smart Contract** — The heart of the protocol. Written in Rust using the Anchor framework. Handles all fund movements — locking collateral, disbursing loans, receiving repayments, liquidating defaults. Nobody can move funds without a valid signed instruction from the relevant wallet.

**Liquidity Pool PDA** — A Program Derived Address that holds the pool's SOL. Owned and controlled exclusively by the Anchor program. Neither the deployer nor any admin can drain it — only the program logic can.

---

## Tech Stack

### Frontend

| Package                           | Version | Purpose                      |
| --------------------------------- | ------- | ---------------------------- |
| `next`                            | 14.x    | React framework, SSR         |
| `react`                           | 18.x    | UI library                   |
| `@solana/wallet-adapter-react`    | ^0.15   | Phantom wallet connection    |
| `@solana/wallet-adapter-phantom`  | ^0.9    | Phantom adapter              |
| `@solana/wallet-adapter-react-ui` | ^0.9    | Connect button UI            |
| `@solana/web3.js`                 | ^1.87   | Solana RPC client            |
| `@project-serum/anchor`           | ^0.29   | Interact with Anchor program |
| `tailwindcss`                     | ^3.x    | Styling                      |
| `axios`                           | ^1.x    | HTTP calls to backend        |

### Backend API

| Package                 | Version | Purpose                  |
| ----------------------- | ------- | ------------------------ |
| `express`               | ^4.x    | HTTP server              |
| `@solana/web3.js`       | ^1.87   | Read on-chain data (RPC) |
| `@project-serum/anchor` | ^0.29   | Program interaction      |
| `prisma`                | ^5.x    | ORM for loan metadata DB |
| `dotenv`                | ^16.x   | Environment config       |
| `cors`                  | ^2.x    | Cross-origin requests    |
| `zod`                   | ^3.x    | Request validation       |

### Smart Contract

| Package          | Version | Purpose                    |
| ---------------- | ------- | -------------------------- |
| `anchor-lang`    | 0.29.0  | Anchor framework (Rust)    |
| `solana-program` | 1.18    | Core Solana types          |
| `spl-token`      | 4.x     | SPL token support (future) |

### Dev / Tooling

| Tool            | Purpose                             |
| --------------- | ----------------------------------- |
| `solana-cli`    | Deploy programs, manage keypairs    |
| `anchor-cli`    | Build, test, deploy Anchor programs |
| `Rust (stable)` | Smart contract language             |
| `Node.js 18+`   | Frontend + backend runtime          |
| `PostgreSQL`    | Loan metadata storage               |
| `Docker`        | Local DB setup                      |

---

## Repository Structure

```
sollend/
├── app/                        # Next.js App Router frontend
│   ├── components/
│   ├── generated/vault/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── lend/
│       └── page.tsx
├── lib/                        # Shared frontend libs/hooks/wallet context
│   ├── hooks/
│   ├── wallet/
│   ├── lamports.ts
│   └── solana-client.ts
├── backend/                    # Node.js API + Prisma
│   ├── src/
│   │   ├── db/prisma.ts
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── loan.ts
│   │   │   └── score.ts
│   │   ├── services/
│   │   │   ├── loanService.ts
│   │   │   └── riskScore.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── anchor/                     # Anchor workspace
│   ├── Anchor.toml
│   ├── Cargo.toml
│   └── programs/vault/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs          # Program entrypoint + Accounts context structs
│           ├── errors.rs
│           ├── tests.rs
│           ├── instructions/
│           │   ├── mod.rs
│           │   ├── initialize_pool.rs
│           │   ├── deposit_pool.rs
│           │   ├── create_loan.rs
│           │   ├── repay_loan.rs
│           │   ├── liquidate.rs
│           │   └── withdraw_pool.rs
│           └── state/
│               ├── mod.rs
│               ├── loan.rs
│               └── pool.rs
├── codama.json
├── package.json
└── README.md
```

---

## Smart Contract Design

The compile-safe program currently wires these five entrypoints in `anchor/programs/vault/src/lib.rs`:

1. `initialize_pool`
2. `deposit_pool`
3. `create_loan`
4. `repay_loan`
5. `liquidate_loan`

`withdraw_pool` exists as a module placeholder at `anchor/programs/vault/src/instructions/withdraw_pool.rs`, but it is not wired as an active on-chain instruction yet.

### `initialize_pool`

Creates the global pool PDA and sets initial protocol state.

### `create_loan`

Borrower submits loan request. Program:

1. Verifies collateral ≥ required amount (based on LTV from risk score)
2. Transfers collateral SOL from borrower → collateral PDA
3. Transfers loan SOL from pool PDA → borrower wallet
4. Creates a `LoanAccount` storing: borrower key, amount, collateral, interest rate, due date, status

### `repay_loan`

Borrower sends back principal + interest. Program:

1. Verifies repayment amount = principal + accrued interest
2. Transfers SOL from borrower → pool PDA
3. Releases collateral from collateral PDA → borrower wallet
4. Updates `LoanAccount` status to `Repaid`
5. Records repayment on-chain (used by risk engine for future scoring)

### `liquidate_loan`

Called by a permissioned liquidator (or a crank) when `current_timestamp > due_date`. Program:

1. Verifies loan is past due
2. Sells collateral: transfers collateral PDA → pool PDA
3. Updates `LoanAccount` status to `Liquidated`
4. Records default on-chain (penalises risk score on next loan request)

### `deposit_pool`

Lender deposits SOL into the liquidity pool PDA. Mints pool share tokens (future — for MVP just records deposit amount).

### `withdraw_pool`

Reserved placeholder for future lender withdrawal flow.

### Account Schemas

```rust
// LoanAccount — one per active loan
pub struct LoanAccount {
    pub borrower: Pubkey,         // borrower's wallet
    pub collateral_amount: u64,   // lamports locked
    pub loan_amount: u64,         // lamports disbursed
    pub interest_rate_bps: u16,   // basis points (500 = 5%)
    pub due_timestamp: i64,       // Unix timestamp
    pub status: LoanStatus,       // Active | Repaid | Liquidated
    pub created_at: i64,
    pub bump: u8,
}

// PoolAccount — one global pool
pub struct PoolAccount {
    pub total_deposited: u64,
    pub total_loaned: u64,
    pub total_interest_earned: u64,
    pub bump: u8,
}
```

---

## Risk Scoring Algorithm

The backend fetches the wallet's on-chain data via Solana RPC and computes a score from 0–100.

```
Final Score = Σ (factor_score × weight)
```

| Factor             | Max Points | How it's measured                                                     |
| ------------------ | ---------- | --------------------------------------------------------------------- |
| Wallet age         | 20         | Days since first transaction (capped at 365 days = 20 pts)            |
| SOL balance        | 20         | Balance relative to loan amount (≥ 3× = full 20 pts)                  |
| Transaction volume | 20         | Total tx count (500+ tx = 20 pts, logarithmic scale)                  |
| Repayment history  | 30         | Previous SolLend loans repaid on time (30 pts each, capped)           |
| DeFi activity      | 10         | Interactions with known Solana DeFi programs (Raydium, Marinade etc.) |

### Score → Loan Terms Mapping

| Score Range | LTV      | Interest Rate (APR) | Max Duration |
| ----------- | -------- | ------------------- | ------------ |
| 80–100      | 80%      | 5%                  | 90 days      |
| 60–79       | 65%      | 10%                 | 60 days      |
| 40–59       | 50%      | 18%                 | 30 days      |
| 20–39       | 35%      | 28%                 | 14 days      |
| 0–19        | Rejected | —                   | —            |

**LTV example:** Score = 75. LTV = 65%. Borrower wants a 1 SOL loan → must lock 1/0.65 = **1.54 SOL** as collateral.

---

## Loan Lifecycle

```
1. CONNECT      Borrower connects Phantom wallet
       ↓
2. SCORE        Backend reads wallet history → computes risk score (0–100)
       ↓
3. TERMS        Loan amount, rate, and duration shown to borrower
       ↓
4. APPROVE      Borrower accepts terms, signs collateral lock transaction
       ↓
5. LOCK         Smart contract moves collateral to PDA vault
       ↓
6. DISBURSE     Smart contract sends SOL loan to borrower's wallet
       ↓
7a. REPAY       Borrower sends principal + interest → collateral released ✓
    OR
7b. DEFAULT     Past due date → liquidator triggers liquidation → collateral → pool ✗
```

---

## Prerequisites

Install these before starting:

```bash
# 1. Rust (stable)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup component add rustfmt

# 2. Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.12/install)"
solana --version   # should print 1.18.x

# 3. Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.29.0
avm use 0.29.0
anchor --version   # should print 0.29.0

# 4. Node.js 18+
node --version     # should print v18.x or v20.x

# 5. Docker (for local PostgreSQL)
docker --version
```

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/sollend.git
cd sollend
```

### 2. Install smart contract dependencies

```bash
# From the project root (Anchor workspace)
anchor build
```

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Install frontend dependencies

```bash
npm install
```

### 5. Start local database

```bash
# From project root
docker run --name sollend-db \
  -e POSTGRES_USER=sollend \
  -e POSTGRES_PASSWORD=sollend \
  -e POSTGRES_DB=sollend \
  -p 5432:5432 -d postgres:15

# Run migrations
cd backend
npx prisma migrate dev --name init
```

### 6. Configure Solana for Devnet

```bash
solana config set --url devnet
solana-keygen new --outfile ~/.config/solana/devnet.json
solana config set --keypair ~/.config/solana/devnet.json

# Airdrop free devnet SOL
solana airdrop 5
solana balance
```

---

## Environment Variables

Use the checked-in templates so you do not have to copy blocks manually:

| Location           | Template                                       | Create                    |
| ------------------ | ---------------------------------------------- | ------------------------- |
| Frontend (Next.js) | [`.env.example`](.env.example)                 | `.env.local` at repo root |
| Backend (API)      | [`backend/.env.example`](backend/.env.example) | `backend/.env`            |

Values below mirror those files; adjust for your deploy.

### Backend (`backend/.env`)

```env
# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=<your_deployed_program_id>
DEPLOYER_KEYPAIR_PATH=~/.config/solana/devnet.json

# Database
DATABASE_URL=postgresql://sollend:sollend@localhost:5432/sollend

# Server
PORT=4000
FRONTEND_URL=http://localhost:3000

# Optional: Helius RPC for better rate limits (recommended)
HELIUS_API_KEY=your_helius_key_here
```

### Frontend (`.env.local` at repo root)

```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=<your_deployed_program_id>
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Deployment placeholders

```env
PROGRAM_ID=placeholder_will_update_after_deploy
POOL_PDA=to_be_initialized_on_devnet
```

---

## Running the Project

### 1. Deploy smart contract to Devnet

```bash
# From project root
anchor deploy --provider.cluster devnet

# Note the Program ID printed — add it to both .env files
# Example: Program Id: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
```

### 2. Initialise the liquidity pool (run once)

```bash
anchor run init-pool --provider.cluster devnet
```

### 3. Start the backend API

```bash
cd backend
npm run dev
# Running on http://localhost:4000
```

### 4. Start the frontend

```bash
npm run dev
# Running on http://localhost:3000
```

### 5. Open in browser

Navigate to `http://localhost:3000`. Click **Connect Wallet**, select Phantom, and make sure Phantom is set to **Devnet** network.

To get test SOL into your Phantom wallet:

```bash
solana airdrop 2 <your_phantom_wallet_address> --url devnet
```

---

## Deployment (Devnet)

### Smart contract

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### Backend (example: Railway / Render)

```bash
# Set environment variables in your hosting dashboard
# Then deploy via Git push or CLI
```

### Frontend (Vercel)

```bash
npx vercel --prod
# Set NEXT_PUBLIC_* env vars in Vercel dashboard
```

## Try It Live

The public demo URL is not published yet.

- Vercel URL: placeholder
- Backend URL: http://localhost:4000 while developing locally

## Hackathon Demo

1. Install the Phantom browser extension and set the wallet to Devnet.
2. Get free devnet SOL from https://faucet.solana.com.
3. Visit the app, connect your wallet, and request a loan.

---

## API Reference

### `GET /score/:walletAddress`

Returns the risk score and recommended loan terms for a wallet.

**Response:**

```json
{
  "walletAddress": "7xKXtg...",
  "score": 72,
  "breakdown": {
    "walletAge": 18,
    "solBalance": 14,
    "txVolume": 15,
    "repaymentHistory": 20,
    "defiActivity": 5
  },
  "terms": {
    "ltv": 0.65,
    "interestRateBps": 1000,
    "maxDurationDays": 60
  }
}
```

### `POST /loan/request`

Creates a loan request record and returns the transaction for the frontend to sign.

**Body:**

```json
{
  "walletAddress": "7xKXtg...",
  "loanAmountLamports": 1000000000,
  "durationDays": 30
}
```

**Response:**

```json
{
  "loanId": "uuid",
  "collateralRequired": 1538461538,
  "interestLamports": 13698630,
  "dueTimestamp": 1735689600,
  "transactionBase64": "<serialised transaction for Phantom to sign>"
}
```

### `POST /loan/repay`

Records a repayment intent and returns the repayment transaction.

### `GET /loan/:walletAddress`

Returns all active and historical loans for a wallet.

---

## Roadmap

### MVP (Hackathon)

- [x] Phantom wallet connect
- [x] On-chain risk score from wallet history
- [x] SOL collateral → SOL loan flow
- [x] Smart contract: create, repay, liquidate
- [x] Lender deposit pool
- [ ] Backend pool stats/activity routes

### Phase 2

- [ ] USDC as loan currency (SPL token support)
- [ ] Pyth Network price feeds for real-time SOL/USD LTV monitoring
- [ ] Auto-liquidation crank (off-chain keeper service)
- [ ] Lender yield dashboard with APY display

### Phase 3

- [ ] Under-collateralised loans via on-chain reputation score
- [ ] Credit delegation (high-score user backs another wallet)
- [ ] eSewa / mobile money repayment gateway (Nepal market)
- [ ] DAO governance for interest rate parameters

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Write tests for any new smart contract instructions
4. Run `anchor test` — all tests must pass
5. Open a pull request with a clear description

---

## License

MIT License — see [LICENSE](./LICENSE)

---

_Built for Frontier Hackathon · Solana Devnet MVP · Open to Mainnet deployment_
