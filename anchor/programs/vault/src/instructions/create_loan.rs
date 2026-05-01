use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::LoanError;
use crate::state::{LoanStatus, PoolAccount};

pub fn handler(
    ctx: Context<crate::CreateLoan>,
    loan_amount_lamports: u64,
    collateral_amount: u64,
    interest_rate_bps: u16,
    duration_days: u8,
) -> Result<()> {
    require!(
        collateral_amount >= loan_amount_lamports,
        LoanError::InsufficientCollateral
    );

    let pool_space = 8 + PoolAccount::LEN;
    let pool_min_rent = Rent::get()?.minimum_balance(pool_space);
    let pool_balance = ctx.accounts.pool.to_account_info().lamports();
    let available_liquidity = pool_balance.saturating_sub(pool_min_rent);
    require!(
        available_liquidity >= loan_amount_lamports,
        LoanError::PoolInsufficientFunds
    );

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower.to_account_info(),
                to: ctx.accounts.collateral_vault.to_account_info(),
            },
        ),
        collateral_amount,
    )?;

    {
        let pool_info = ctx.accounts.pool.to_account_info();
        let borrower_info = ctx.accounts.borrower.to_account_info();
        let mut pool_lamports = pool_info.try_borrow_mut_lamports()?;
        let mut borrower_lamports = borrower_info.try_borrow_mut_lamports()?;

        **pool_lamports = (**pool_lamports).checked_sub(loan_amount_lamports).unwrap();
        **borrower_lamports = (**borrower_lamports).checked_add(loan_amount_lamports).unwrap();
    }

    let now = Clock::get()?.unix_timestamp;
    let loan_index = ctx.accounts.borrower_profile.loan_index;
    let due_timestamp = now.checked_add(i64::from(duration_days) * 86_400).unwrap();

    let loan = &mut ctx.accounts.loan_account;
    loan.borrower = ctx.accounts.borrower.key();
    loan.collateral_amount = collateral_amount;
    loan.loan_amount = loan_amount_lamports;
    loan.interest_rate_bps = interest_rate_bps;
    loan.due_timestamp = due_timestamp;
    loan.created_at = now;
    loan.status = LoanStatus::Active;
    loan.loan_index = loan_index;
    loan.bump = ctx.bumps.loan_account;

    let collateral_vault = &mut ctx.accounts.collateral_vault;
    collateral_vault.borrower = ctx.accounts.borrower.key();
    collateral_vault.loan_index = loan_index;
    collateral_vault.bump = ctx.bumps.collateral_vault;

    let borrower_profile = &mut ctx.accounts.borrower_profile;
    if borrower_profile.total_loans == 0 && borrower_profile.loan_index == 0 {
        borrower_profile.borrower = ctx.accounts.borrower.key();
        borrower_profile.total_repaid = 0;
        borrower_profile.total_defaulted = 0;
        borrower_profile.bump = ctx.bumps.borrower_profile;
    }
    borrower_profile.total_loans = borrower_profile.total_loans.checked_add(1).unwrap();
    borrower_profile.loan_index = borrower_profile.loan_index.checked_add(1).unwrap();

    let pool = &mut ctx.accounts.pool;
    pool.total_loaned = pool.total_loaned.checked_add(loan_amount_lamports).unwrap();

    Ok(())
}
