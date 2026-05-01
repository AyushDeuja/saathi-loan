use anchor_lang::prelude::*;

#[account]
pub struct LoanAccount {
    pub borrower: Pubkey,
    pub collateral_amount: u64,
    pub loan_amount: u64,
    pub interest_rate_bps: u16,
    pub due_timestamp: i64,
    pub created_at: i64,
    pub status: LoanStatus,
    pub loan_index: u64,
    pub bump: u8,
}

impl LoanAccount {
    pub const LEN: usize = 32 + 8 + 8 + 2 + 8 + 8 + 1 + 8 + 1;
}

#[account]
pub struct BorrowerProfile {
    pub borrower: Pubkey,
    pub total_loans: u64,
    pub total_repaid: u64,
    pub total_defaulted: u64,
    pub loan_index: u64,
    pub bump: u8,
}

impl BorrowerProfile {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct CollateralVault {
    pub borrower: Pubkey,
    pub loan_index: u64,
    pub bump: u8,
}

impl CollateralVault {
    pub const LEN: usize = 32 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LoanStatus {
    Active,
    Repaid,
    Liquidated,
}
