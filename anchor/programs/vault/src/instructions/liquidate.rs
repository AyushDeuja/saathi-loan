use anchor_lang::prelude::*;

use crate::errors::LoanError;
use crate::state::LoanStatus;

pub fn handler(ctx: Context<crate::LiquidateLoan>) -> Result<()> {
    let loan = &mut ctx.accounts.loan_account;
    match loan.status {
        LoanStatus::Repaid => return err!(LoanError::LoanAlreadyRepaid),
        LoanStatus::Liquidated => return err!(LoanError::LoanAlreadyLiquidated),
        LoanStatus::Active => {}
    }

    let now = Clock::get()?.unix_timestamp;
    require!(now > loan.due_timestamp, LoanError::LoanNotYetDue);

    {
        let collateral_info = ctx.accounts.collateral_vault.to_account_info();
        let pool_info = ctx.accounts.pool.to_account_info();
        let mut collateral_lamports = collateral_info.try_borrow_mut_lamports()?;
        let mut pool_lamports = pool_info.try_borrow_mut_lamports()?;

        **collateral_lamports = (**collateral_lamports).checked_sub(loan.collateral_amount).unwrap();
        **pool_lamports = (**pool_lamports).checked_add(loan.collateral_amount).unwrap();
    }

    loan.status = LoanStatus::Liquidated;

    let borrower_profile = &mut ctx.accounts.borrower_profile;
    borrower_profile.total_defaulted = borrower_profile.total_defaulted.checked_add(1).unwrap();

    Ok(())
}
