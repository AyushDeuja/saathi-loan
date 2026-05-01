use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

pub use errors::LoanError;
pub use state::{BorrowerProfile, CollateralVault, LoanAccount, LoanStatus, PoolAccount};

#[cfg(test)]
mod tests;

declare_id!("2P9pEjiLeri1nQBaqcYDJ3crQwasZ2p5BdJYMpPPXTFv");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        instructions::initialize_pool::handler(ctx)
    }

    pub fn deposit_pool(ctx: Context<DepositPool>, amount: u64) -> Result<()> {
        instructions::deposit_pool::handler(ctx, amount)
    }

    pub fn create_loan(
        ctx: Context<CreateLoan>,
        loan_amount_lamports: u64,
        collateral_amount: u64,
        interest_rate_bps: u16,
        duration_days: u8,
    ) -> Result<()> {
        instructions::create_loan::handler(
            ctx,
            loan_amount_lamports,
            collateral_amount,
            interest_rate_bps,
            duration_days,
        )
    }

    pub fn repay_loan(ctx: Context<RepayLoan>) -> Result<()> {
        instructions::repay_loan::handler(ctx)
    }

    pub fn liquidate_loan(ctx: Context<LiquidateLoan>) -> Result<()> {
        instructions::liquidate::handler(ctx)
    }
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + PoolAccount::LEN,
        seeds = [b"pool"],
        bump,
    )]
    pub pool: Account<'info, PoolAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositPool<'info> {
    #[account(mut)]
    pub lender: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pool"],
        bump = pool.bump,
    )]
    pub pool: Account<'info, PoolAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pool"],
        bump = pool.bump,
    )]
    pub pool: Account<'info, PoolAccount>,
    #[account(
        init_if_needed,
        payer = borrower,
        space = 8 + BorrowerProfile::LEN,
        seeds = [b"borrower", borrower.key().as_ref()],
        bump,
    )]
    pub borrower_profile: Account<'info, BorrowerProfile>,
    #[account(
        init,
        payer = borrower,
        space = 8 + LoanAccount::LEN,
        seeds = [
            b"loan",
            borrower.key().as_ref(),
            &borrower_profile.loan_index.to_le_bytes(),
        ],
        bump,
    )]
    pub loan_account: Account<'info, LoanAccount>,
    #[account(
        init,
        payer = borrower,
        space = 8 + CollateralVault::LEN,
        seeds = [
            b"collateral",
            borrower.key().as_ref(),
            &borrower_profile.loan_index.to_le_bytes(),
        ],
        bump,
    )]
    pub collateral_vault: Account<'info, CollateralVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RepayLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,
    #[account(
        mut,
        seeds = [b"pool"],
        bump = pool.bump,
    )]
    pub pool: Account<'info, PoolAccount>,
    #[account(
        mut,
        has_one = borrower,
        seeds = [
            b"loan",
            borrower.key().as_ref(),
            &loan_account.loan_index.to_le_bytes(),
        ],
        bump = loan_account.bump,
    )]
    pub loan_account: Account<'info, LoanAccount>,
    #[account(
        mut,
        seeds = [b"borrower", borrower.key().as_ref()],
        bump = borrower_profile.bump,
    )]
    pub borrower_profile: Account<'info, BorrowerProfile>,
    #[account(
        mut,
        close = borrower,
        seeds = [
            b"collateral",
            borrower.key().as_ref(),
            &loan_account.loan_index.to_le_bytes(),
        ],
        bump = collateral_vault.bump,
    )]
    pub collateral_vault: Account<'info, CollateralVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LiquidateLoan<'info> {
    pub liquidator: Signer<'info>,
    /// CHECK: Borrower key is used for PDA derivations and checked against loan account.
    pub borrower: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"pool"],
        bump = pool.bump,
    )]
    pub pool: Account<'info, PoolAccount>,
    #[account(
        mut,
        has_one = borrower,
        seeds = [
            b"loan",
            borrower.key().as_ref(),
            &loan_account.loan_index.to_le_bytes(),
        ],
        bump = loan_account.bump,
    )]
    pub loan_account: Account<'info, LoanAccount>,
    #[account(
        mut,
        seeds = [b"borrower", borrower.key().as_ref()],
        bump = borrower_profile.bump,
    )]
    pub borrower_profile: Account<'info, BorrowerProfile>,
    #[account(
        mut,
        close = pool,
        seeds = [
            b"collateral",
            borrower.key().as_ref(),
            &loan_account.loan_index.to_le_bytes(),
        ],
        bump = collateral_vault.bump,
    )]
    pub collateral_vault: Account<'info, CollateralVault>,
}
