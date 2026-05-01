#[cfg(test)]
mod tests {
    use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
    use crate::{BorrowerProfile, LoanAccount, LoanStatus, PoolAccount, ID as PROGRAM_ID};
    use litesvm::LiteSVM;
    use solana_sdk::{
        clock::Clock,
        instruction::Instruction,
        pubkey::Pubkey,
        signature::Keypair,
        signer::Signer,
        system_program,
        transaction::Transaction,
    };

    const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

    fn get_pool_pda() -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"pool"], &PROGRAM_ID)
    }

    fn get_borrower_profile_pda(borrower: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[b"borrower", borrower.as_ref()], &PROGRAM_ID)
    }

    fn get_loan_pda(borrower: &Pubkey, loan_index: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"loan", borrower.as_ref(), &loan_index.to_le_bytes()],
            &PROGRAM_ID,
        )
    }

    fn get_collateral_pda(borrower: &Pubkey, loan_index: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"collateral", borrower.as_ref(), &loan_index.to_le_bytes()],
            &PROGRAM_ID,
        )
    }

    fn send_ix(svm: &mut LiteSVM, signer: &Keypair, ix: Instruction) -> Result<(), String> {
        let blockhash = svm.latest_blockhash();
        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&signer.pubkey()),
            &[signer],
            blockhash,
        );

        svm.send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{e:?}"))
    }

    fn deserialize_account<T: AccountDeserialize>(svm: &LiteSVM, pubkey: &Pubkey) -> T {
        let account = svm
            .get_account(pubkey)
            .expect("Expected account to exist");
        let mut bytes = account.data.as_slice();
        T::try_deserialize(&mut bytes).expect("Failed to deserialize account")
    }

    fn build_initialize_pool_ix(authority: Pubkey, pool: Pubkey) -> Instruction {
        let accounts = crate::accounts::InitializePool {
            authority,
            pool,
            system_program: system_program::ID,
        };

        Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts.to_account_metas(None),
            data: crate::instruction::InitializePool {}.data(),
        }
    }

    fn build_deposit_pool_ix(lender: Pubkey, pool: Pubkey, amount: u64) -> Instruction {
        let accounts = crate::accounts::DepositPool {
            lender,
            pool,
            system_program: system_program::ID,
        };

        Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts.to_account_metas(None),
            data: crate::instruction::DepositPool { amount }.data(),
        }
    }

    fn build_create_loan_ix(
        borrower: Pubkey,
        pool: Pubkey,
        borrower_profile: Pubkey,
        loan_account: Pubkey,
        collateral_vault: Pubkey,
        loan_amount_lamports: u64,
        collateral_amount: u64,
        interest_rate_bps: u16,
        duration_days: u8,
    ) -> Instruction {
        let accounts = crate::accounts::CreateLoan {
            borrower,
            pool,
            borrower_profile,
            loan_account,
            collateral_vault,
            system_program: system_program::ID,
        };

        Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts.to_account_metas(None),
            data: crate::instruction::CreateLoan {
                loan_amount_lamports,
                collateral_amount,
                interest_rate_bps,
                duration_days,
            }
            .data(),
        }
    }

    fn build_repay_loan_ix(
        borrower: Pubkey,
        pool: Pubkey,
        loan_account: Pubkey,
        borrower_profile: Pubkey,
        collateral_vault: Pubkey,
    ) -> Instruction {
        let accounts = crate::accounts::RepayLoan {
            borrower,
            pool,
            loan_account,
            borrower_profile,
            collateral_vault,
            system_program: system_program::ID,
        };

        Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts.to_account_metas(None),
            data: crate::instruction::RepayLoan {}.data(),
        }
    }

    fn build_liquidate_loan_ix(
        liquidator: Pubkey,
        borrower: Pubkey,
        pool: Pubkey,
        loan_account: Pubkey,
        borrower_profile: Pubkey,
        collateral_vault: Pubkey,
    ) -> Instruction {
        let accounts = crate::accounts::LiquidateLoan {
            liquidator,
            borrower,
            pool,
            loan_account,
            borrower_profile,
            collateral_vault,
        };

        Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts.to_account_metas(None),
            data: crate::instruction::LiquidateLoan {}.data(),
        }
    }

    #[test]
    fn test_initialize_pool_success() {
        let mut svm = LiteSVM::new().with_sysvars();

        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();

        let authority = Keypair::new();
        svm.airdrop(&authority.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();

        let (pool_pda, _) = get_pool_pda();
        let ix = build_initialize_pool_ix(authority.pubkey(), pool_pda);

        send_ix(&mut svm, &authority, ix).expect("initialize_pool should succeed");

        let pool: PoolAccount = deserialize_account(&svm, &pool_pda);
        assert_eq!(pool.authority, authority.pubkey());
        assert_eq!(pool.total_deposited, 0);
        assert_eq!(pool.total_loaned, 0);
        assert_eq!(pool.total_interest_earned, 0);
    }

    #[test]
    fn test_deposit_pool_success() {
        let mut svm = LiteSVM::new().with_sysvars();

        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();

        let authority = Keypair::new();
        let lender = Keypair::new();
        svm.airdrop(&authority.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&lender.pubkey(), 10 * LAMPORTS_PER_SOL).unwrap();

        let (pool_pda, _) = get_pool_pda();

        let init_ix = build_initialize_pool_ix(authority.pubkey(), pool_pda);
        send_ix(&mut svm, &authority, init_ix).unwrap();

        let deposit_amount = 2 * LAMPORTS_PER_SOL;
        let deposit_ix = build_deposit_pool_ix(lender.pubkey(), pool_pda, deposit_amount);
        send_ix(&mut svm, &lender, deposit_ix).expect("deposit_pool should succeed");

        let pool: PoolAccount = deserialize_account(&svm, &pool_pda);
        assert_eq!(pool.total_deposited, deposit_amount);
    }

    #[test]
    fn test_create_loan_success_with_valid_collateral() {
        let mut svm = LiteSVM::new().with_sysvars();

        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();

        let authority = Keypair::new();
        let lender = Keypair::new();
        let borrower = Keypair::new();

        svm.airdrop(&authority.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&lender.pubkey(), 10 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&borrower.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();

        let (pool_pda, _) = get_pool_pda();
        let (profile_pda, _) = get_borrower_profile_pda(&borrower.pubkey());
        let (loan_pda, _) = get_loan_pda(&borrower.pubkey(), 0);
        let (collateral_pda, _) = get_collateral_pda(&borrower.pubkey(), 0);

        send_ix(
            &mut svm,
            &authority,
            build_initialize_pool_ix(authority.pubkey(), pool_pda),
        )
        .unwrap();

        send_ix(
            &mut svm,
            &lender,
            build_deposit_pool_ix(lender.pubkey(), pool_pda, 4 * LAMPORTS_PER_SOL),
        )
        .unwrap();

        send_ix(
            &mut svm,
            &borrower,
            build_create_loan_ix(
                borrower.pubkey(),
                pool_pda,
                profile_pda,
                loan_pda,
                collateral_pda,
                LAMPORTS_PER_SOL,
                LAMPORTS_PER_SOL,
                500,
                30,
            ),
        )
        .expect("create_loan should succeed");

        let loan: LoanAccount = deserialize_account(&svm, &loan_pda);
        let profile: BorrowerProfile = deserialize_account(&svm, &profile_pda);

        assert_eq!(loan.borrower, borrower.pubkey());
        assert_eq!(loan.loan_amount, LAMPORTS_PER_SOL);
        assert_eq!(loan.collateral_amount, LAMPORTS_PER_SOL);
        assert!(matches!(loan.status, LoanStatus::Active));
        assert_eq!(profile.total_loans, 1);
        assert_eq!(profile.loan_index, 1);
    }

    #[test]
    fn test_create_loan_fails_with_insufficient_collateral() {
        let mut svm = LiteSVM::new().with_sysvars();

        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();

        let authority = Keypair::new();
        let lender = Keypair::new();
        let borrower = Keypair::new();

        svm.airdrop(&authority.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&lender.pubkey(), 10 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&borrower.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();

        let (pool_pda, _) = get_pool_pda();
        let (profile_pda, _) = get_borrower_profile_pda(&borrower.pubkey());
        let (loan_pda, _) = get_loan_pda(&borrower.pubkey(), 0);
        let (collateral_pda, _) = get_collateral_pda(&borrower.pubkey(), 0);

        send_ix(
            &mut svm,
            &authority,
            build_initialize_pool_ix(authority.pubkey(), pool_pda),
        )
        .unwrap();

        send_ix(
            &mut svm,
            &lender,
            build_deposit_pool_ix(lender.pubkey(), pool_pda, 4 * LAMPORTS_PER_SOL),
        )
        .unwrap();

        let result = send_ix(
            &mut svm,
            &borrower,
            build_create_loan_ix(
                borrower.pubkey(),
                pool_pda,
                profile_pda,
                loan_pda,
                collateral_pda,
                LAMPORTS_PER_SOL,
                LAMPORTS_PER_SOL / 2,
                500,
                30,
            ),
        );

        assert!(result.is_err(), "create_loan should fail when collateral is too low");
    }

    #[test]
    fn test_repay_loan_success() {
        let mut svm = LiteSVM::new().with_sysvars();

        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();

        let authority = Keypair::new();
        let lender = Keypair::new();
        let borrower = Keypair::new();

        svm.airdrop(&authority.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&lender.pubkey(), 10 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&borrower.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();

        let (pool_pda, _) = get_pool_pda();
        let (profile_pda, _) = get_borrower_profile_pda(&borrower.pubkey());
        let (loan_pda, _) = get_loan_pda(&borrower.pubkey(), 0);
        let (collateral_pda, _) = get_collateral_pda(&borrower.pubkey(), 0);

        send_ix(
            &mut svm,
            &authority,
            build_initialize_pool_ix(authority.pubkey(), pool_pda),
        )
        .unwrap();
        send_ix(
            &mut svm,
            &lender,
            build_deposit_pool_ix(lender.pubkey(), pool_pda, 5 * LAMPORTS_PER_SOL),
        )
        .unwrap();

        send_ix(
            &mut svm,
            &borrower,
            build_create_loan_ix(
                borrower.pubkey(),
                pool_pda,
                profile_pda,
                loan_pda,
                collateral_pda,
                LAMPORTS_PER_SOL,
                LAMPORTS_PER_SOL,
                500,
                30,
            ),
        )
        .unwrap();

        send_ix(
            &mut svm,
            &borrower,
            build_repay_loan_ix(
                borrower.pubkey(),
                pool_pda,
                loan_pda,
                profile_pda,
                collateral_pda,
            ),
        )
        .expect("repay_loan should succeed");

        let loan: LoanAccount = deserialize_account(&svm, &loan_pda);
        let profile: BorrowerProfile = deserialize_account(&svm, &profile_pda);
        let pool: PoolAccount = deserialize_account(&svm, &pool_pda);

        assert!(matches!(loan.status, LoanStatus::Repaid));
        assert_eq!(profile.total_repaid, 1);
        assert_eq!(pool.total_interest_earned, 50_000_000);
    }

    #[test]
    fn test_liquidate_loan_success_after_due_date() {
        let mut svm = LiteSVM::new().with_sysvars();

        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();

        let authority = Keypair::new();
        let lender = Keypair::new();
        let borrower = Keypair::new();
        let liquidator = Keypair::new();

        svm.airdrop(&authority.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&lender.pubkey(), 10 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&borrower.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&liquidator.pubkey(), LAMPORTS_PER_SOL).unwrap();

        let (pool_pda, _) = get_pool_pda();
        let (profile_pda, _) = get_borrower_profile_pda(&borrower.pubkey());
        let (loan_pda, _) = get_loan_pda(&borrower.pubkey(), 0);
        let (collateral_pda, _) = get_collateral_pda(&borrower.pubkey(), 0);

        send_ix(
            &mut svm,
            &authority,
            build_initialize_pool_ix(authority.pubkey(), pool_pda),
        )
        .unwrap();
        send_ix(
            &mut svm,
            &lender,
            build_deposit_pool_ix(lender.pubkey(), pool_pda, 5 * LAMPORTS_PER_SOL),
        )
        .unwrap();

        send_ix(
            &mut svm,
            &borrower,
            build_create_loan_ix(
                borrower.pubkey(),
                pool_pda,
                profile_pda,
                loan_pda,
                collateral_pda,
                LAMPORTS_PER_SOL,
                LAMPORTS_PER_SOL,
                500,
                0,
            ),
        )
        .unwrap();

        let loan: LoanAccount = deserialize_account(&svm, &loan_pda);
        let mut clock = svm.get_sysvar::<Clock>();
        clock.unix_timestamp = loan.due_timestamp + 1;
        svm.set_sysvar(&clock);

        send_ix(
            &mut svm,
            &liquidator,
            build_liquidate_loan_ix(
                liquidator.pubkey(),
                borrower.pubkey(),
                pool_pda,
                loan_pda,
                profile_pda,
                collateral_pda,
            ),
        )
        .expect("liquidate_loan should succeed after due timestamp");

        let loan_after: LoanAccount = deserialize_account(&svm, &loan_pda);
        let profile: BorrowerProfile = deserialize_account(&svm, &profile_pda);

        assert!(matches!(loan_after.status, LoanStatus::Liquidated));
        assert_eq!(profile.total_defaulted, 1);
    }
}
