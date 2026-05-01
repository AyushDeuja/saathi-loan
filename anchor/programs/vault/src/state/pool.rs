use anchor_lang::prelude::*;

#[account]
pub struct PoolAccount {
    pub authority: Pubkey,
    pub total_deposited: u64,
    pub total_loaned: u64,
    pub total_interest_earned: u64,
    pub bump: u8,
}

impl PoolAccount {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 1;
}
