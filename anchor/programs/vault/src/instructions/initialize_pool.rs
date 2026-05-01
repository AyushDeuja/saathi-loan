use anchor_lang::prelude::*;

pub fn handler(ctx: Context<crate::InitializePool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    pool.authority = ctx.accounts.authority.key();
    pool.total_deposited = 0;
    pool.total_loaned = 0;
    pool.total_interest_earned = 0;
    pool.bump = ctx.bumps.pool;
    Ok(())
}
