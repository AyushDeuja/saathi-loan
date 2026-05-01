use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::LoanError;
use crate::state::LoanStatus;

pub fn handler(ctx: Context<crate::RepayLoan>) -> Result<()> {
    let loan = &mut ctx.accounts.loan_account;
    match loan.status {
        LoanStatus::Repaid => return err!(LoanError::LoanAlreadyRepaid),
        LoanStatus::Liquidated => return err!(LoanError::LoanAlreadyLiquidated),
        LoanStatus::Active => {}
    }

    let interest = ((loan.loan_amount as u128) * (loan.interest_rate_bps as u128) / 10_000) as u64;
    let total_due = loan.loan_amount.checked_add(interest).unwrap();

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower.to_account_info(),
                to: ctx.accounts.pool.to_account_info(),
            },
        ),
        total_due,
    )?;

    {
        let collateral_info = ctx.accounts.collateral_vault.to_account_info();
        let borrower_info = ctx.accounts.borrower.to_account_info();
        let mut collateral_lamports = collateral_info.try_borrow_mut_lamports()?;
        let mut borrower_lamports = borrower_info.try_borrow_mut_lamports()?;

        **collateral_lamports = (**collateral_lamports).checked_sub(loan.collateral_amount).unwrap();
        **borrower_lamports = (**borrower_lamports).checked_add(loan.collateral_amount).unwrap();
    }

    loan.status = LoanStatus::Repaid;

    let borrower_profile = &mut ctx.accounts.borrower_profile;
    borrower_profile.total_repaid = borrower_profile.total_repaid.checked_add(1).unwrap();

    let pool = &mut ctx.accounts.pool;
    pool.total_interest_earned = pool.total_interest_earned.checked_add(interest).unwrap();

    Ok(())
}
