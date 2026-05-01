# SolLend Progress Log

Last updated: 2026-04-28

## Project Snapshot

- Monorepo set up with three active parts:
  - Next.js app in `app/`
  - Anchor program in `anchor/`
  - Express + Prisma backend in `backend/`
- Core setup commands are working:
  - `npm run setup` (root) succeeds
  - `anchor build` (anchor/) succeeds

## Completed Work

### 1. Solana Program (Anchor)

- Anchor program scaffolded at `anchor/programs/vault/src/lib.rs`.
- Phase 1 loan protocol implemented and verified end-to-end:
  - `initialize_pool`
  - `deposit_pool`
  - `create_loan`
  - `repay_loan`
  - `liquidate_loan`
- Added protocol accounts and PDA flows:
  - `PoolAccount`
  - `BorrowerProfile`
  - `LoanAccount`
  - collateral vault PDA per-loan
- Added custom error codes for loan lifecycle and solvency checks:
  - `LoanAlreadyRepaid`
  - `LoanNotYetDue`
  - `LoanAlreadyLiquidated`
  - `InsufficientCollateral`
  - `PoolInsufficientFunds`
- Added comprehensive Rust tests in `anchor/programs/vault/src/tests.rs` covering:
  - initialize pool
  - pool deposit
  - create loan success/failure
  - repay loan (principal + interest)
  - liquidation after due timestamp (mocked clock)

### 2. Generated Solana Client

- Codama config present (`codama.json`).
- Generated client artifacts available under `app/generated/vault/`.
- Frontend is wired to generated instructions (including PDA derivation patterns).

### 3. Frontend (Next.js)

- Phase 3 frontend flow implemented with dedicated pages and components:
  - Landing page at `app/page.tsx` with SolLend hero + wallet CTA + feature cards
  - Borrow flow at `app/borrow/page.tsx` with live risk score, breakdown bars, terms, form, and request flow
  - Dashboard at `app/dashboard/page.tsx` with loan list/cards, risk badge, pool balance, and repay action
- New reusable UI components added:
  - `app/components/navbar.tsx`
  - `app/components/risk-score-gauge.tsx`
  - `app/components/loan-card.tsx`
- Frontend API + on-chain hooks added:
  - `app/lib/api.ts` (typed backend client for score/loan routes)
  - `app/lib/hooks/use-loan-program.ts` (`createLoan`, `repayLoan`, `getPoolBalance`)
  - `app/lib/loan-local.ts` (local mapping for loan PDA metadata used by repay flow)
- App provider stack upgraded:
  - React Query (`QueryClientProvider`) enabled in `app/components/providers.tsx`
  - `react-hot-toast` Toaster added while preserving existing providers

### 4. Lender Experience (Phase 4 started)

- Added lender page at `app/lend/page.tsx` with pool stats cards, a deposit form, and recent pool activity UI.
- Extended `app/lib/hooks/use-loan-program.ts` with pool-deposit and pool-stats helpers.
- Lender flow is partially wired, but backend support for `GET /loan/pool/stats` and `GET /loan/all` is still missing.

### 5. Backend API (Express + TypeScript)

- Backend project scaffolded with TypeScript and ESM.
- API entrypoint is live at `backend/src/index.ts`.
- Health endpoint implemented: `GET /health`.
- Phase 2 risk-scoring engine implemented in `backend/src/services/riskScore.ts`:
  - wallet age scoring from oldest signature history
  - SOL balance scoring from lamports
  - transaction volume scoring (capped pagination)
  - repayment history scoring from Prisma loan records
  - DeFi activity scoring from known program interactions
  - score-to-terms mapping (`ltv`, `interestRateBps`, `maxDurationDays`, `approved`)
- Implemented API routes with validation and error handling:
  - `GET /score/:walletAddress` returns full `RiskScoreResult`
  - `POST /loan/request` validates input, gates approval, computes collateral/interest, persists loan
  - `GET /loan/:walletAddress` returns wallet loans ordered by latest first
- Added backend Prisma client helper at `backend/src/db/prisma.ts`.

### 6. Database Layer (Prisma)

- Prisma initialized with PostgreSQL datasource.
- `Loan` model defined in `backend/prisma/schema.prisma` with fields for:
  - wallet address
  - loan amount
  - collateral amount
  - interest bps
  - duration
  - due timestamp
  - risk score
  - lifecycle status + timestamps

### 7. Tooling and Dependency Hygiene

- Backend package moved to `@coral-xyz/anchor` dependency.
- Added backend TypeScript typings needed for Express/CORS:
  - `@types/express`
  - `@types/cors`
- Type errors in backend entrypoint were resolved.

## Current State (Important)

- Phase 3 frontend is functionally implemented across landing, borrow, and dashboard routes.
- Phase 4 has begun on the frontend with the lender page and pool helpers, but the supporting backend routes are not complete yet.
- Anchor Phase 1 loan protocol compiles and local tests pass.
- Phase 2 backend routes/services are implemented and wired to Prisma.
- Loan creation persistence is active for approved borrowers.
- Current repay wiring depends on local browser loan PDA metadata (stored in `app/lib/loan-local.ts`) for on-chain repay calls.

## Verification Log

- `NO_DNA=1 anchor build` succeeded for the updated loan protocol.
- `NO_DNA=1 anchor test --provider.cluster localnet` passed (`7 passed, 0 failed`).
- `npm run build` (backend) succeeds after Phase 2 implementation.
- `GET /health` returns `{ "status": "ok" }`.
- `GET /score/:walletAddress` returns full score object for a valid public key.
- `POST /loan/request` rejects low-score borrowers with clear response and terms payload.
- `npm run codama:js` regenerated `app/generated/vault/` for loan protocol instructions/accounts.
- `npm run build` (root Next.js app) succeeds with Phase 3 pages and hooks.
- `app/lend/page.tsx` was added for the lender experience, but it still depends on unimplemented pool stats/activity backend routes.

## Milestone Audit Trail

- Phase 1 marked complete at 2026-04-25 13:03:55 UTC.
- Repository HEAD at completion mark: `77b57da`.

## Next Priorities

1. Finish Phase 4 backend pool routes (`/loan/pool/stats` and `/loan/all`) so the lender page works end-to-end.
2. Persist loan PDA/collateral PDA metadata in backend so repay works across devices/sessions.
3. Add integration tests for backend score/loan endpoints and frontend-backend contract behavior.
4. Start Phase 5 devnet deployment and polish once the lender flow is fully wired.

## Notes

- This file tracks implementation progress, not final product readiness.
- Keep this file updated after each major milestone or architecture change.
