use anchor_lang::prelude::*;

#[error_code]
pub enum LoanError {
    #[msg("Loan has already been repaid")]
    LoanAlreadyRepaid,
    #[msg("Loan is not yet due")]
    LoanNotYetDue,
    #[msg("Loan has already been liquidated")]
    LoanAlreadyLiquidated,
    #[msg("Insufficient collateral for requested loan")]
    InsufficientCollateral,
    #[msg("Pool does not have enough available funds")]
    PoolInsufficientFunds,
}
