use borsh::{BorshDeserialize,BorshSerialize};
use anchor_lang::{prelude::*, AnchorDeserialize, AnchorSerialize, Key, solana_program::program::{invoke}};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("rafrZNbxGdfFUBzddkzgtcHLqijmjarEihYcUuCuByV");

#[program]
pub mod fundssotre{

    use super::*;

    pub fn init_store(
        ctx : Context<InitStore>,
        _bump : u8
        ) -> ProgramResult {
        let store = &mut ctx.accounts.store;
        store.owner = ctx.accounts.owner.key();
        store.rand = ctx.accounts.rand.key();
        store.bump = _bump;
        
        Ok(())
    }

    pub fn transfer_authority(
        ctx : Context<TransferAuthority>,
        _new_owner : Pubkey,
        )->ProgramResult{
        let store = &mut ctx.accounts.store;
        store.owner = _new_owner;
        Ok(())
    }

    pub fn deposit_sol(
        ctx : Context<DepositSol>,
        _amount : u64
        ) -> ProgramResult {

        sol_transfer_to_pool(
            SolTransferToPoolParams{
                source : ctx.accounts.owner.to_account_info().clone(),
                destination : ctx.accounts.store.clone(),
                system : ctx.accounts.system_program.to_account_info().clone(),
                amount : _amount
            }
        )?;

        Ok(())
    }

    pub fn deposit_token(
        ctx : Context<DepositToken>,
        _amount : u64
        ) -> ProgramResult {

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer{
                from : ctx.accounts.token_from.to_account_info().clone(),
                to : ctx.accounts.token_to.to_account_info().clone(),
                authority : ctx.accounts.owner.to_account_info().clone()    
            }
        );

        token::transfer(cpi_ctx, _amount as u64)?;

        Ok(())
    }

    pub fn claim_sol(
        ctx : Context<ClaimSol>,
        _amount : u64
    ) -> ProgramResult {

        sol_transfer(
            &mut ctx.accounts.store_address,
            &mut ctx.accounts.reciever,
            _amount
        )?;

        Ok(())
    }

    pub fn claim_token(
        ctx : Context<ClaimToken>,
        _amount : u64
    ) -> ProgramResult {

        let store = &mut ctx.accounts.store;

        let store_seeds = &[store.rand.as_ref(),&[store.bump]];

        let signer = &[&store_seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer{
                from : ctx.accounts.token_from.to_account_info().clone(),
                to : ctx.accounts.token_to.to_account_info().clone(),
                authority : store.to_account_info().clone(),
            },
            signer
        );

        token::transfer(cpi_ctx, _amount)?;

        Ok(())
    }
}

struct SolTransferToPoolParams<'a> {
    /// CHECK:
    pub source: AccountInfo<'a>,
    /// CHECK:
    pub destination: ProgramAccount<'a, DataStore>,
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
    store : ProgramAccount<'info, DataStore>,

    system_program : Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimSol<'info> {
    /// CHECK:
    #[account(mut, signer)]
    owner : AccountInfo<'info>,   

    /// CHECK:
    #[account(mut)]
    reciever : AccountInfo<'info>, 

    /// CHECK:
    #[account(mut, has_one=owner)]
    store : ProgramAccount<'info,DataStore>,

    /// CHECK:
    #[account(mut)]
    store_address : AccountInfo<'info>
}

#[derive(Accounts)]
pub struct DepositToken<'info>{
    #[account(mut)]
    owner : Signer<'info>,

    #[account(mut)]
    store : ProgramAccount<'info, DataStore>,

    #[account(mut, constraint= token_from.owner==owner.key())]
    token_from : Account<'info, TokenAccount>,

    #[account(mut, constraint= token_to.owner==store.key())]
    token_to : Account<'info, TokenAccount>,

    token_program : Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimToken<'info>{
    #[account(mut, signer)]
    owner : AccountInfo<'info>,

    #[account(mut)]
    reciever : AccountInfo<'info>, 

    #[account(mut, has_one=owner)]
    store : ProgramAccount<'info, DataStore>,

    #[account(mut, constraint= token_from.owner==store.key())]
    token_from : Account<'info, TokenAccount>,

    #[account(mut, constraint= token_to.owner==reciever.key())]
    token_to : Account<'info, TokenAccount>,

    token_program : Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info>{
    #[account(mut)]
    owner : Signer<'info>,
    
    #[account(mut,has_one=owner)]
    store : ProgramAccount<'info, DataStore>,
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct InitStore<'info>{
    #[account(mut)]
    owner : Signer<'info>,
    
    #[account(init, seeds=[(*rand.key).as_ref()], bump=_bump, payer=owner, space=8+STORE_POOL_SIZE)]
    store : ProgramAccount<'info, DataStore>,
    
    rand : AccountInfo<'info>,
    
    system_program : Program<'info, System>
}

pub const STORE_POOL_SIZE : usize = 32*2+1;

#[account]
pub struct DataStore{
    owner : Pubkey,
    rand : Pubkey,
    bump : u8,
}

#[error]
pub enum PoolError{

    #[msg("Invalid owner")]
    InvalidPoolOwner,

    #[msg("Insufficent Funds")]
    InsufficentFunds,

    #[msg("sol transfer failed")]
    SolTransferFailed
}