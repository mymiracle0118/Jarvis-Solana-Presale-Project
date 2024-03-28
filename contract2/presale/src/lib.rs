use borsh::{BorshDeserialize,BorshSerialize};
use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize, Key, solana_program::program::{invoke}};
// use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("preCY7QmspyxB2anVKjvxgvxVbKg4rwQVK1ffPhTk8Y");

#[program]
pub mod presale{

    use super::*;

    pub fn init_pool(
        ctx : Context<InitPool>,
        _bump : u8,
        _min_sol: u64,
        _max_sol: u64,
        _softcap: u64,
        _hardcap: u64
        ) -> ProgramResult {
        msg!("+++++ Init Pool +++++");
        let pool = &mut ctx.accounts.pool;
        pool.owner = ctx.accounts.owner.key();
        pool.rand = ctx.accounts.rand.key();
        pool.withdrawer = ctx.accounts.withdrawer.key();
        pool.min_sol = _min_sol;
        pool.max_sol = _max_sol;
        pool.softcap = _softcap;
        pool.hardcap = _hardcap;
        pool.raised = 0;
        pool.withdraw_amount = 0;
        pool.pause = false;
        pool.bump = _bump;
        
        Ok(())
    }

    pub fn init_whitelist_info(
        ctx : Context<InitWhitelistInfo>,
        _bump : u8
        ) -> ProgramResult {
        msg!("+++++ Init Whitelist Info +++++");

        let whitelist_data = &mut ctx.accounts.data;

        whitelist_data.pool = ctx.accounts.pool.key();
        whitelist_data.contributer = ctx.accounts.owner.key();
        whitelist_data.contribute_start = 0;
        whitelist_data.contribute_last = 0;
        whitelist_data.whitelist = false;
        whitelist_data.amount = 0;

        Ok(())
    }

    pub fn transfer_authority(
        ctx : Context<TransferAuthority>,
        _new_owner : Pubkey,
        )->ProgramResult{
        msg!("+++++ Transfer Authority +++++");
        let pool = &mut ctx.accounts.pool;
        pool.owner = _new_owner;
        Ok(())
    }

    pub fn set_withdrawer(
        ctx : Context<SetWithdrawer>,
        _new_withdrawer : Pubkey,
        )->ProgramResult{
        msg!("+++++ Set Withdrawer +++++");
        let pool = &mut ctx.accounts.pool;
        pool.withdrawer = _new_withdrawer;
        Ok(())
    }

    pub fn set_pause(
        ctx : Context<ModifyPool>,
        _pause : bool
        ) -> ProgramResult {
        msg!("+++++ Set Minsol +++++");
        let pool = &mut ctx.accounts.pool;
        pool.pause = _pause;
        Ok(())
    }

    pub fn set_minsol(
        ctx : Context<ModifyPool>,
        _minsol : u64
        ) -> ProgramResult {
        msg!("+++++ Set Minsol +++++");
        let pool = &mut ctx.accounts.pool;
        pool.min_sol = _minsol;
        Ok(())
    }

    pub fn set_maxsol(
        ctx : Context<ModifyPool>,
        _maxsol : u64
        ) -> ProgramResult {
        msg!("+++++ Set Maxsol +++++");
        let pool = &mut ctx.accounts.pool;
        pool.max_sol = _maxsol;
        Ok(())
    }

    pub fn set_softcap(
        ctx : Context<ModifyPool>,
        _softcap : u64
        ) -> ProgramResult {
        msg!("+++++ Set Softcap +++++");
        let pool = &mut ctx.accounts.pool;
        pool.softcap = _softcap;
        Ok(())
    }

    pub fn set_hardcap(
        ctx : Context<ModifyPool>,
        _hardcap : u64
        ) -> ProgramResult {
        msg!("+++++ Set Hardcap +++++");
        let pool = &mut ctx.accounts.pool;
        pool.hardcap = _hardcap;
        Ok(())
    }

    pub fn add_whitelist(
        ctx : Context<ModifyWhitelist>,
        _flag : bool
        ) -> ProgramResult {    
        msg!("+++++ Add Whitelist +++++");

        let whitelist_info = &mut ctx.accounts.whitelist_info;

        whitelist_info.whitelist = true;

        Ok(())
    }

    pub fn remove_whitelist(
        ctx : Context<ModifyWhitelist>,
        _flag : bool
        ) -> ProgramResult {    
        msg!("+++++ Remove Whitelist +++++");

        let whitelist_info = &mut ctx.accounts.whitelist_info;

        whitelist_info.whitelist = false;

        Ok(())
    }

    pub fn deposit_sol(
        ctx : Context<DepositSol>,
        _amount : u64
        ) -> ProgramResult {    
        msg!("+++++ Deposit Sol +++++");

        let pool = &mut ctx.accounts.pool;
        let whitelist_info = &mut ctx.accounts.whitelist_info;
        let clock = Clock::from_account_info(&ctx.accounts.clock)?;

        if whitelist_info.whitelist == false {
            msg!("Not WhiteList Member");
            return Err(PoolError::NotWhitelistMember.into());
        }

        if _amount < pool.min_sol {
            msg!("Insufficent funds");
            return Err(PoolError::InsufficentFunds.into());
        }

        if _amount + whitelist_info.amount > pool.max_sol {
            msg!("Overflow Contribute Amount");
            return Err(PoolError::OverflowContibute.into());
        }

        if _amount + pool.raised > pool.hardcap {
            msg!("Hardcap has reached");
            return Err(PoolError::HardcapReached.into());
        }

        if pool.pause == true {
            msg!("Presale is Pause State");
            return Err(PoolError::InPauseState.into());
        }

        whitelist_info.amount += _amount;
        pool.raised += _amount;

        sol_transfer_to_pool(
            SolTransferToPoolParams{
                source : ctx.accounts.owner.to_account_info().clone(),
                destination : ctx.accounts.pool.clone(),
                system : ctx.accounts.system_program.to_account_info().clone(),
                amount : _amount
            }
        )?;

        if whitelist_info.contribute_start == 0 {
            whitelist_info.contribute_start = clock.unix_timestamp as u64;
        } else {
            whitelist_info.contribute_last = clock.unix_timestamp as u64;
        }
        
        Ok(())
    }

    pub fn claim_sol(
        ctx : Context<ClaimSol>,
        _amount : u64
    ) -> ProgramResult {
        msg!("+++++ Claim Sol +++++");

        let pool = &mut ctx.accounts.pool;

        if _amount > pool.raised - pool.withdraw_amount {
            msg!("Insufficent funds");
            return Err(PoolError::InsufficentFunds.into());
        }

        sol_transfer(
            &mut ctx.accounts.pool_address,
            &mut ctx.accounts.owner,
            _amount
        )?;

        pool.withdraw_amount += _amount;

        Ok(())
    }

}

struct SolTransferToPoolParams<'a> {
    /// CHECK:
    pub source: AccountInfo<'a>,
    /// CHECK:
    pub destination: ProgramAccount<'a, Pool>,
    /// CHECK:
    pub system: AccountInfo<'a>,
    /// CHECK:
    pub amount: u64,
}

fn sol_transfer_to_pool(params: SolTransferToPoolParams<'_>) -> ProgramResult {
    let SolTransferToPoolParams {
        source,
        destination,
        system,
        amount
    } = params;

    let result = invoke(
        &anchor_lang::solana_program::system_instruction::transfer(
            source.key,
            &destination.key(),
            amount,
        ),
        &[source, destination.to_account_info(), system],
    );

    result.map_err(|_| PoolError::SolTransferFailed.into())
}

fn sol_transfer(
    from_account: &AccountInfo,
    to_account: &AccountInfo,
    amount_of_lamports: u64,
) -> ProgramResult {
    // Does the from account have enough lamports to transfer?
    if **from_account.try_borrow_lamports()? < amount_of_lamports {
        msg!("Insufficent funds");
        return Err(PoolError::InsufficentFunds.into());
    }
    // Debit from_account and credit to_account
    **from_account.try_borrow_mut_lamports()? -= amount_of_lamports;
    **to_account.try_borrow_mut_lamports()? += amount_of_lamports;
    Ok(())
}

#[derive(Accounts)]
pub struct DepositSol<'info>{
    #[account(mut)]
    owner : Signer<'info>,

    #[account(mut)]
    pool : ProgramAccount<'info, Pool>,

    #[account(mut,
        constraint= whitelist_info.pool == pool.key()
            && whitelist_info.contributer == owner.key())]
    whitelist_info : ProgramAccount<'info, WhitelistInfo>,

    clock : AccountInfo<'info>,

    system_program : Program<'info, System>
}

#[derive(Accounts)]
pub struct ClaimSol<'info> {
    /// CHECK:
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    /// CHECK:
    #[account(mut,
        constraint= pool.withdrawer == owner.key())]
    pool : ProgramAccount<'info, Pool>,

    /// CHECK:
    #[account(mut)]
    pool_address : AccountInfo<'info>,

    system_program : Program<'info, System>
}

#[derive(Accounts)]
pub struct TransferAuthority<'info>{
    #[account(mut)]
    owner : Signer<'info>,
    
    #[account(mut,has_one=owner)]
    pool : ProgramAccount<'info, Pool>,
}

#[derive(Accounts)]
pub struct SetWithdrawer<'info>{
    #[account(mut)]
    owner : Signer<'info>,
    
    #[account(mut,has_one=owner)]
    pool : ProgramAccount<'info, Pool>,
}

#[derive(Accounts)]
pub struct ModifyWhitelist<'info>{
    #[account(mut)]
    owner : Signer<'info>,

    #[account(mut, has_one=owner)]
    pool : ProgramAccount<'info, Pool>,

    #[account(mut,
        constraint= whitelist_info.pool == pool.key()
            && whitelist_info.contributer == owner.key())]
    whitelist_info : ProgramAccount<'info, WhitelistInfo>,

    system_program : Program<'info, System>
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct InitPool<'info>{
    #[account(mut)]
    owner : Signer<'info>,
    
    #[account(init, seeds=[(*rand.key).as_ref()], bump=_bump, payer=owner, space= 8 + DATA_POOL_SIZE)]
    pool : ProgramAccount<'info, Pool>,
    
    withdrawer: AccountInfo<'info>,

    rand : AccountInfo<'info>,
    
    system_program : Program<'info, System>
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct InitWhitelistInfo<'info>{
    #[account(mut, signer)]
    owner : AccountInfo<'info>,

    #[account(has_one=owner)]
    pool : ProgramAccount<'info, Pool>,

    #[account(init,
        seeds=[owner.key().as_ref(), pool.key().as_ref()],
        bump=_bump,
        payer=owner,
        space= 8 + CONTRIBUTE_INFO_SIZE)]
    data : ProgramAccount<'info, WhitelistInfo>,

    system_program : Program<'info, System>
}

#[derive(Accounts)]
pub struct ModifyPool<'info>{
    #[account(mut)]
    owner : Signer<'info>,

    #[account(mut, has_one=owner)]
    pool : ProgramAccount<'info, Pool>,
}

pub const DATA_POOL_SIZE : usize = 32 * 3 + 32 * 6 + 1 + 1;
pub const CONTRIBUTE_INFO_SIZE : usize = 32 * 2 + 1 + 32 * 4;

#[account]
pub struct Pool {
    owner : Pubkey,
    rand : Pubkey,
    withdrawer: Pubkey,
    min_sol: u64,
    max_sol: u64,
    softcap: u64,
    hardcap: u64,
    raised: u64,
    withdraw_amount: u64,
    pause: bool,
    bump : u8,
}

#[account]
pub struct WhitelistInfo {
    pool: Pubkey,
    contributer : Pubkey,
    whitelist : bool,
    contribute_start: u64,
    contribute_last: u64,
    amount: u64,
}

#[error]
pub enum PoolError {
    #[msg("Invalid owner")]
    InvalidPoolOwner,

    #[msg("Insufficent Funds")]
    InsufficentFunds,

    #[msg("Not Whitelist member")]
    NotWhitelistMember,

    #[msg("Overflow Contribute Amount")]
    OverflowContibute,

    #[msg("Hardcap Reached")]
    HardcapReached,

    #[msg("Presale is in Pause State")]
    InPauseState,

    #[msg("sol transfer failed")]
    SolTransferFailed
}