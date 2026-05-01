use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

pub fn handler(ctx: Context<crate::DepositPool>, amount: u64) -> Result<()> {
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.lender.to_account_info(),
                to: ctx.accounts.pool.to_account_info(),
            },
        ),
        amount,
    )?;

    let pool = &mut ctx.accounts.pool;
    pool.total_deposited = pool.total_deposited.checked_add(amount).unwrap();
    Ok(())
}
