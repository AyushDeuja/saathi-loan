# SolLend — Phase-Wise AI Build Prompt

> Copy each phase prompt into Claude Code (or your AI agent) one at a time.
> Complete and verify each phase before moving to the next.
> The project is scaffolded with: `npx create-solana-dapp@latest` → name: `sollend`, framework: `Next.js`, template: `anchor`

---

## Repo Sync (2026-04-28)

Current workspace differs from the original scaffold layout assumed below. Use this mapping while executing phases:

- Anchor workspace root: `anchor/`
- Program path: `anchor/programs/vault/src/lib.rs`
- Generated IDL path: `anchor/target/idl/vault.json`
- Frontend app path: `app/` (not `frontend/src/`)
- Shared frontend libs/hooks path: `app/lib/`
- Frontend env file: `.env.local` at repo root

Current progress snapshot:

- Phase 0: complete
- Phase 1: complete (full loan protocol implemented + tests passing on localnet)
- Phase 2: complete (risk scoring + loan routes + persistence)
- Phase 3: complete (landing, borrow, dashboard, score UI, hooks)
- Phase 4: in progress (lender page + deposit hook added; backend pool routes still pending)
- Phase 5: not started

---

## Phase 0 — Project Bootstrap

```
You are helping me build a decentralized loan platform called SolLend on Solana.
The project has already been scaffolded using `npx create-solana-dapp@latest`
with Next.js and the Anchor template.

The project root is: sollend/

Do the following setup tasks:

1. In the root `Anchor.toml`, set the cluster to `devnet` and program name to `sollend`.

2. In `anchor/programs/vault/Cargo.toml`, ensure the following dependencies are present:
   - anchor-lang = "0.29.0" (with features = ["init-if-needed"])
   - anchor-spl = "0.29.0"

3. In project root (`/home/samrat-karki/solend`), install these additional npm packages:
   - axios
   - @tanstack/react-query
   - zustand
   - react-hot-toast
   Run: npm install axios @tanstack/react-query zustand react-hot-toast

4. Create a `backend/` directory at the project root with the following structure:
   backend/
   ├── src/
   │   ├── index.ts
   │   ├── routes/
   │   │   ├── score.ts
   │   │   └── loan.ts
   │   └── services/
   │       ├── riskScore.ts
   │       └── loanService.ts
   ├── prisma/
   │   └── schema.prisma
   ├── package.json
   └── tsconfig.json

5. In `backend/package.json`, include these dependencies:
   - express, cors, dotenv, zod (runtime)
   - @solana/web3.js (^1.87)
   - @project-serum/anchor (^0.29)
   - prisma, @prisma/client
   - tsx, typescript (dev)

6. In `backend/prisma/schema.prisma`, create a Loan model:
   model Loan {
     id               String   @id @default(uuid())
     walletAddress    String
     loanAmount       BigInt
     collateralAmount BigInt
     interestBps      Int
     durationDays     Int
     dueTimestamp     BigInt
     status           String   @default("ACTIVE")
     riskScore        Int
     createdAt        DateTime @default(now())
     updatedAt        DateTime @updatedAt
   }

7. Create `backend/.env` with:
   SOLANA_RPC_URL=https://api.devnet.solana.com
   PROGRAM_ID=placeholder_will_update_after_deploy
   DATABASE_URL=postgresql://sollend:sollend@localhost:5432/sollend
   PORT=4000
   FRONTEND_URL=http://localhost:3000

8. Create `.env.local` at project root with:
   NEXT_PUBLIC_SOLANA_NETWORK=devnet
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
   NEXT_PUBLIC_PROGRAM_ID=placeholder_will_update_after_deploy
   NEXT_PUBLIC_API_URL=http://localhost:4000

Confirm all files are created and dependencies are installed before proceeding.
```

---

## Phase 1 — Anchor Smart Contract

```
We are building SolLend, a Solana loan DApp using the Anchor framework.
The Anchor workspace is at the project root. The program is in:
anchor/programs/vault/src/lib.rs

Replace the existing demo program completely with a full loan protocol.
Write the entire Anchor program with the following specifications:

=== ACCOUNT SCHEMAS ===

1. PoolAccount (global, one per program):
   - authority: Pubkey (program deployer)
   - total_deposited: u64 (lamports)
   - total_loaned: u64
   - total_interest_earned: u64
   - bump: u8

2. LoanAccount (one per loan, PDA seeded by borrower pubkey + loan index):
   - borrower: Pubkey
   - collateral_amount: u64 (lamports locked)
   - loan_amount: u64 (lamports disbursed)
   - interest_rate_bps: u16 (basis points, e.g. 500 = 5%)
   - due_timestamp: i64 (Unix)
   - created_at: i64
   - status: LoanStatus enum (Active, Repaid, Liquidated)
   - loan_index: u64 (per-borrower counter)
   - bump: u8

3. BorrowerProfile (one per borrower wallet, PDA seeded by borrower pubkey):
   - borrower: Pubkey
   - total_loans: u64
   - total_repaid: u64
   - total_defaulted: u64
   - loan_index: u64 (counter for PDA seed)
   - bump: u8

=== INSTRUCTIONS ===

1. initialize_pool
   - Creates the PoolAccount PDA (seed: b"pool")
   - Sets authority to signer
   - Only callable once

2. deposit_pool
   - Lender deposits SOL into pool PDA
   - Transfers lamports from lender → pool PDA
   - Updates pool.total_deposited

3. create_loan
   - Accounts: borrower, pool PDA, collateral PDA, loan account PDA, borrower profile PDA, system program
   - Parameters: loan_amount_lamports: u64, collateral_amount: u64, interest_rate_bps: u16, duration_days: u8
   - Validates: collateral_amount >= loan_amount (minimum 100% collateralization for MVP)
   - Transfers collateral from borrower → collateral PDA (seed: b"collateral", borrower pubkey, loan_index)
   - Transfers loan SOL from pool PDA → borrower wallet
   - Creates LoanAccount with status Active and computed due_timestamp
   - Increments BorrowerProfile.loan_index and total_loans
   - Updates pool.total_loaned

4. repay_loan
   - Accounts: borrower, pool PDA, collateral PDA, loan account PDA, borrower profile, system program
   - Calculates total_due = loan_amount + (loan_amount * interest_rate_bps / 10000)
   - Transfers total_due from borrower → pool PDA
   - Transfers collateral from collateral PDA → borrower
   - Sets LoanAccount.status = Repaid
   - Increments BorrowerProfile.total_repaid
   - Updates pool.total_interest_earned

5. liquidate_loan
   - Accounts: liquidator (any signer), pool PDA, collateral PDA, loan account PDA, borrower profile
   - Validates: Clock::get()?.unix_timestamp > loan.due_timestamp AND loan.status == Active
   - Transfers collateral from collateral PDA → pool PDA
   - Sets LoanAccount.status = Liquidated
   - Increments BorrowerProfile.total_defaulted

=== ERROR CODES ===
Define custom errors:
- LoanAlreadyRepaid
- LoanNotYetDue
- LoanAlreadyLiquidated
- InsufficientCollateral
- PoolInsufficientFunds

After writing the program, also write tests in:
anchor/programs/vault/src/tests.rs

Tests should cover:
- initialize_pool success
- deposit_pool success
- create_loan success with valid collateral
- create_loan failure with insufficient collateral
- repay_loan success (full principal + interest)
- liquidate_loan success after due date (mock timestamp)

Run `anchor build` to verify the program compiles with zero errors.
Run `anchor test` on localnet to confirm all tests pass.
```

---

## Phase 2 — Risk Scoring Engine (Backend)

```
We are building SolLend. The backend is a Node.js/Express API in the backend/ directory.
The Solana RPC URL is https://api.devnet.solana.com

Build the Risk Scoring Engine in backend/src/services/riskScore.ts

=== SCORING ALGORITHM ===

The function signature is:
  async function computeRiskScore(walletAddress: string, connection: Connection): Promise<RiskScoreResult>

RiskScoreResult type:
  {
    score: number           // 0-100
    breakdown: {
      walletAge: number     // 0-20 pts
      solBalance: number    // 0-20 pts
      txVolume: number      // 0-20 pts
      repaymentHistory: number // 0-30 pts
      defiActivity: number  // 0-10 pts
    }
    terms: LoanTerms
  }

LoanTerms type:
  {
    ltv: number             // e.g. 0.65
    interestRateBps: number // e.g. 1000 for 10%
    maxDurationDays: number
    approved: boolean
  }

=== SCORING FACTORS ===

1. walletAge (0-20 pts):
   - Fetch the wallet's first transaction signature using getSignaturesForAddress with limit:1 and before:undefined, then paginate to the oldest
   - Calculate days since first tx
   - Score = min(days / 365 * 20, 20)
   - If no transactions: 0 pts

2. solBalance (0-20 pts):
   - Fetch current SOL balance in lamports, convert to SOL
   - Score = min(balance / 5 * 20, 20)  (5 SOL = full 20 pts)

3. txVolume (0-20 pts):
   - Count total confirmed transactions (use getSignaturesForAddress with pagination, cap at 1000)
   - Score = min(log10(count + 1) / log10(501) * 20, 20)

4. repaymentHistory (0-30 pts):
   - Query the Prisma database for this wallet: count of REPAID loans vs total loans
   - If no loans: 15 pts (neutral, unknown history)
   - Score = (repaid / total) * 30

5. defiActivity (0-10 pts):
   - Check if wallet has interacted with known Devnet program IDs (use a hardcoded list of 3-5 common Devnet DeFi programs)
   - Each interaction = 2 pts, max 10 pts

=== TERMS MAPPING ===

score 80-100 → ltv: 0.80, interestRateBps: 500,  maxDurationDays: 90, approved: true
score 60-79  → ltv: 0.65, interestRateBps: 1000, maxDurationDays: 60, approved: true
score 40-59  → ltv: 0.50, interestRateBps: 1800, maxDurationDays: 30, approved: true
score 20-39  → ltv: 0.35, interestRateBps: 2800, maxDurationDays: 14, approved: true
score 0-19   → ltv: 0,    interestRateBps: 0,    maxDurationDays: 0,  approved: false

=== API ROUTES ===

Build backend/src/routes/score.ts:
  GET /score/:walletAddress
  - Validates walletAddress is a valid Solana public key using PublicKey from @solana/web3.js
  - Calls computeRiskScore
  - Returns full RiskScoreResult as JSON
  - Error handling: 400 for invalid address, 500 for RPC failures

Build backend/src/routes/loan.ts:
  POST /loan/request
  Body: { walletAddress, loanAmountLamports, durationDays }
  - Validates body with Zod schema
  - Fetches risk score
  - If approved: calculates collateralRequired = loanAmountLamports / ltv
  - Creates Loan record in DB with status ACTIVE
  - Returns: { loanId, collateralRequired, interestLamports, dueTimestamp, terms }

  GET /loan/:walletAddress
  - Returns all loans for wallet from DB
  - Ordered by createdAt DESC

Build backend/src/index.ts:
  - Express server on PORT from .env
  - CORS enabled for FRONTEND_URL
  - Mount routes at /score and /loan
  - Health check: GET /health returns { status: "ok" }

Run `npx tsx src/index.ts` and verify all routes respond correctly.
Test GET /score/<valid_devnet_wallet> returns a valid score object.
```

---

## Phase 3 — Frontend Core (Wallet + Loan Request)

```
We are building SolLend, a Solana loan DApp.
The frontend is a Next.js app in `app/` with shared code in `app/lib/`.
Phantom wallet adapter is already configured from the create-solana-dapp scaffold.
The Solana network is devnet.

Build the following frontend components and pages. Use Tailwind CSS for all styling.
The design should be dark-themed, professional, and DeFi-appropriate.

=== GLOBAL SETUP ===

1. Update app/layout.tsx:
   - Add React Query provider (QueryClientProvider)
   - Add Toaster from react-hot-toast
   - Keep existing WalletProvider from the scaffold
   - Set page title to "SolLend — Decentralized Loans on Solana"

2. Create lib/api.ts:
   - axios instance with baseURL = process.env.NEXT_PUBLIC_API_URL
   - Export typed functions:
     - getRiskScore(walletAddress: string): Promise<RiskScoreResult>
     - requestLoan(body: LoanRequestBody): Promise<LoanResponse>
     - getLoans(walletAddress: string): Promise<Loan[]>
   - Include all TypeScript types matching the backend response shapes

3. Create lib/hooks/use-loan-program.ts:
   - Uses useAnchorProvider() from the scaffold
   - Loads the Anchor IDL from anchor/target/idl/vault.json
   - Exports:
     - createLoan(loanAmount, collateralAmount, interestBps, durationDays): sends the create_loan instruction
     - repayLoan(loanPDA, collateralPDA, loanIndex): sends the repay_loan instruction
     - getPoolBalance(): fetches pool PDA SOL balance

=== PAGES ===

4. Rewrite app/page.tsx (Landing page):
   - Hero section: "Borrow SOL. No bank. No KYC."
   - Subheading: "Connect your Phantom wallet and get a loan based on your on-chain reputation."
   - Large "Connect Wallet" button (use existing `app/components/wallet-button.tsx`)
   - Three feature cards: "Risk-Based Scoring", "Instant Disbursement", "On-Chain Collateral"
   - If wallet is already connected, show a "Go to Dashboard →" button instead

5. Create app/borrow/page.tsx (Loan request flow):

   Step 1 — Score display:
   - On mount, if wallet is connected: call GET /score/:walletAddress
   - Show loading skeleton while fetching
   - Display: risk score (large number, 0-100), score breakdown bars (wallet age, balance, tx volume, repayment history, DeFi activity), and approved loan terms (LTV, interest rate, max duration)
   - Show "Insufficient credit score" if score < 20 with explanation

   Step 2 — Loan form (shown only if score >= 20):
   - Input: loan amount in SOL (max enforced by pool balance)
   - Input: duration in days (dropdown: 7, 14, 30, 60, 90 — filtered by max allowed for their score)
   - Auto-calculated display: collateral required (SOL), total repayment (principal + interest), due date
   - "Request Loan" button

   Step 3 — Transaction flow:
   - On submit: POST /loan/request to get collateralRequired
   - Call createLoan() from useLoanProgram hook
   - Show Phantom wallet signing prompt
   - On success: toast "Loan disbursed! Check your wallet." + redirect to /dashboard
   - On failure: toast with error message

6. Create app/dashboard/page.tsx (Active loans):
   - Require wallet connection (redirect to / if not connected)
   - Call GET /loan/:walletAddress
   - Show pool SOL balance (call getPoolBalance())
   - Active loans table: amount, collateral, interest rate, due date, status badge, "Repay" button
   - Repay flow: call repayLoan() → Phantom sign → success toast
   - If no loans: "No active loans. Ready to borrow?" → link to /borrow
   - Show risk score badge in top right corner of page

=== COMPONENTS ===

7. Create app/components/risk-score-gauge.tsx:
   - Circular gauge showing score 0-100
   - Color: red (0-39), yellow (40-59), green (60-100)
   - Animated fill on mount
   - Shows score number in center

8. Create app/components/loan-card.tsx:
   - Props: loan object
   - Shows: amount, collateral, status badge, due date countdown
   - If status = ACTIVE and past due: shows "Overdue" in red

9. Create app/components/navbar.tsx:
   - Logo: "SolLend" on the left
   - Nav links: Borrow, Dashboard, Lend (placeholder)
   - WalletMultiButton on the right
   - SOL balance display if connected

Use TypeScript strictly. No `any` types.
All API calls must handle loading and error states.
Run `npm run dev` and verify all three pages render without errors.
```

---

## Phase 4 — Lender UI & Pool Management

```
We are adding the Lender side of SolLend.
Frontend is in `app/` + `app/lib/`, backend in `backend/`.
The Anchor program already has deposit_pool and withdraw_pool instructions.

=== BACKEND ===

1. Add to backend/src/routes/loan.ts:

   GET /pool/stats
   - Fetches PoolAccount on-chain using the program
   - Returns: { totalDeposited, totalLoaned, totalInterestEarned, availableLiquidity }

   POST /pool/deposit (for logging only — actual deposit is on-chain)
   - Body: { walletAddress, amountLamports }
   - Logs deposit intent to DB (optional PoolDeposit model)

=== FRONTEND ===

2. Create app/lend/page.tsx:

   Section 1 — Pool stats:
   - Fetch GET /pool/stats on mount
   - Display cards: Total Pool Size (SOL), Total Loaned Out, Available Liquidity, Estimated APY
   - APY calculation: (totalInterestEarned / totalDeposited) * (365 / days_since_launch) * 100

   Section 2 — Deposit form:
   - Input: amount in SOL to deposit
   - "Deposit SOL" button
   - On click: call deposit_pool instruction from useLoanProgram hook → Phantom sign
   - Success toast: "Deposit successful! You are now earning yield."

   Section 3 — Pool activity (last 10 loans):
   - Table: wallet (truncated), amount, status, date
   - Fetch from GET /loan/all (add this route to backend — returns last 10 loans across all wallets)

3. Add deposit_pool and withdraw_pool to lib/hooks/use-loan-program.ts:
   - depositPool(amountLamports: number): sends deposit_pool instruction
   - getPoolStats(): reads PoolAccount on-chain and returns stats object

4. Update Navbar to make the "Lend" link active and route to /lend

Verify:
- Lender can deposit SOL into the pool via Phantom
- Pool stats update after deposit
- Pool stats are visible without wallet connection

Current repo note:

- The lender page exists at `app/lend/page.tsx` and the frontend hook now includes `depositPool()` and `getPoolStats()`.
- Backend support for `GET /loan/pool/stats` and `GET /loan/all` is still missing, so the lender flow is not fully wired end-to-end yet.
```

---

## Phase 5 — Deploy to Devnet & Polish

```
We are deploying SolLend to Solana Devnet and adding final polish.

=== DEPLOYMENT ===

1. Deploy the Anchor program to Devnet:
   Run: anchor deploy --provider.cluster devnet
   Copy the printed Program ID.

2. Update PROGRAM_ID in:
   - backend/.env
   - .env.local
   - Anchor.toml (under [programs.devnet])
   - app/generated/vault + any frontend program constants (regenerate via `npm run setup` and use `anchor/target/idl/vault.json`)

3. Initialize the pool on Devnet (run once):
   Create a script at scripts/init-pool.ts:
   - Connects to devnet
   - Loads the deployer keypair from ~/.config/solana/devnet.json
   - Calls the initialize_pool instruction
   - Logs the pool PDA address
   Run: npx tsx scripts/init-pool.ts

4. Airdrop initial liquidity for demo purposes:
   Create scripts/fund-pool.ts:
   - Airdrops 10 SOL to the deployer on devnet
   - Calls deposit_pool with 5 SOL
   Run: npx tsx scripts/fund-pool.ts

=== ERROR HANDLING & POLISH ===

5. Add global error boundary in app/layout.tsx:
   - Catches Anchor/transaction errors
   - Shows user-friendly toast messages for common errors:
     - "User rejected the request" → "Transaction cancelled"
     - "Insufficient funds" → "Not enough SOL in your wallet"
     - "Program error 6002" → "Insufficient collateral"

6. Add loading states everywhere:
   - Skeleton loaders for score fetch, loan list, pool stats
   - Disabled + spinner on all buttons during transaction processing
   - "Waiting for confirmation..." toast during Phantom signing

7. Add a transaction explorer link:
   - After any successful transaction, show toast with:
     "View on Solscan →" linking to https://solscan.io/tx/{txSignature}?cluster=devnet

8. Add an About/FAQ section to the landing page:
   - "How is my risk score calculated?" (brief explanation)
   - "Is my collateral safe?" (explain PDA custody)
   - "What happens if I don't repay?" (explain liquidation)
   - "Is this a real bank?" (no — it is a DApp, explain briefly)

=== README UPDATE ===

9. Update the project README.md:
   - Add the deployed Program ID
   - Add the pool PDA address
   - Add a "Try it live" section with the Vercel URL (placeholder)
   - Add a "Hackathon Demo" section with a 3-step quickstart:
     1. Install Phantom browser extension and set to Devnet
     2. Get free devnet SOL from https://faucet.solana.com
     3. Visit the app, connect wallet, and request a loan

Run `anchor test --provider.cluster devnet` to confirm program works on Devnet.
Run `npm run build` at repo root — zero build errors required.

Status note:

- Devnet deployment, pool initialization, and final polish remain outstanding.
```

---

## Quick Reference

### Commands cheatsheet

```bash
# Smart contract
anchor build                          # compile Rust program
anchor test                           # run tests on localnet
anchor deploy --provider.cluster devnet  # deploy to devnet

# Backend
cd backend && npx tsx src/index.ts    # start API server

# Frontend
npm run dev                           # start Next.js dev server from repo root

# Devnet SOL
solana airdrop 2 <your_address> --url devnet

# Check program logs
solana logs --url devnet
```

### PDA seeds reference

| Account          | Seeds                                                  |
| ---------------- | ------------------------------------------------------ |
| Pool             | `["pool"]`                                             |
| Borrower Profile | `["borrower", borrower_pubkey]`                        |
| Loan             | `["loan", borrower_pubkey, loan_index_as_bytes]`       |
| Collateral Vault | `["collateral", borrower_pubkey, loan_index_as_bytes]` |

### Score → Terms quick reference

| Score  | LTV | APR | Max Days |
| ------ | --- | --- | -------- |
| 80-100 | 80% | 5%  | 90       |
| 60-79  | 65% | 10% | 60       |
| 40-59  | 50% | 18% | 30       |
| 20-39  | 35% | 28% | 14       |
| 0-19   | ❌  | —   | —        |
