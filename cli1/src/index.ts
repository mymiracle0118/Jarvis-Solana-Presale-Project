import {
  Connection,
  Keypair,
  Signer,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
  ConfirmOptions,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
  RpcResponseAndContext,
  SimulatedTransactionResponse,
  Commitment,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  clusterApiUrl
} from "@solana/web3.js"
import * as bs58 from 'bs58'
import fs from 'fs'
import * as anchor from '@project-serum/anchor'
import { program } from 'commander';
// import { programs } from '@metaplex/js';
import log from 'loglevel';
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";

program.version('0.0.1');
log.setLevel('info');

// const programId = new PublicKey('AirdfxxqajyegRGW1RpY5JfPyYiZ2Z9WYAZxmhKzxoKo')
const programId = new PublicKey('presniX9hhdaCKFXD6fkmEs5cNuL6GWmtjAz6u87NMz')
const pool_address = new PublicKey('BsRHBE5SKCaai8bJzGqmt7Xs8nkj6rNECRim8LUdBzkN')
const withdrawer = new PublicKey('E4xZQpNFmLhzrck35nBZAdUHYPMhGGWUegiY7XxWccrd');
const idl=JSON.parse(fs.readFileSync('../contract1/target/idl/presale.json','utf8'))
// const { metadata: { Metadata } } = programs

const confirmOption : ConfirmOptions = {
    commitment : 'finalized',
    preflightCommitment : 'finalized',
    skipPreflight : false
}

const sleep = (ms : number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

function loadWalletKey(keypair : any): Keypair {
  if (!keypair || keypair == '') {
    throw new Error('Keypair is required!');
  }
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString())),
  );
  log.info(`wallet public key: ${loaded.publicKey}`);
  log.info(`wallet secret key: ${bs58.encode(loaded.secretKey)}`)
  return loaded;
}

async function getContributeInfoAccount(owner : PublicKey, pool: PublicKey) {
  // console.log(owner, pool, token);
  return await PublicKey.findProgramAddress([owner.toBuffer(),pool.toBuffer()], programId)
}

const getContributeInfo = async (conn: Connection, address: PublicKey) => {
  let wallet = new anchor.Wallet(Keypair.generate())
  let provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)
  let poolData = await program.account.contributeInfo.fetch(address)
  return poolData;
}

programCommand('init_pool')
  .requiredOption(
    '-k, --keypair <path>',
    'Solana wallet location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env,keypair,info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const owner = loadWalletKey(keypair)
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const rand = Keypair.generate().publicKey;
    const [pool, bump] = await PublicKey.findProgramAddress([rand.toBuffer()],programId)
    let transaction = new Transaction()
    transaction.add(program.instruction.initPool(
      new anchor.BN(bump),
      new anchor.BN(0),
      new anchor.BN(100000),
      new anchor.BN(100000),
      new anchor.BN(0),
      {
        accounts:{
          owner : owner.publicKey,
          pool : pool,
          withdrawer : owner.publicKey,
          rand : rand,
          systemProgram : SystemProgram.programId
        }
      }
    ))
    const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
    console.log("POOL : "+pool.toBase58())
    console.log("Transaction ID : " + hash)
    }catch(err){
      console.log(err)
    }
  })

programCommand('get_pool')
  .action(async (directory,cmd)=>{
    const {env, pool} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const poolAddress = new PublicKey(pool_address)
    const wallet = new anchor.Wallet(Keypair.generate())
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const poolData = await program.account.pool.fetch(poolAddress)
    // console.log(poolData);
    console.log("============ Pool Data ===========");
    console.log("Owner : " + poolData.owner.toBase58())
    console.log("Rand : " + poolData.rand.toBase58())
    console.log("Withdrawer : " + poolData.withdrawer.toBase58())
    console.log("Minsol : " + poolData.minSol.toNumber())
    console.log("Maxsol : " + poolData.maxSol.toNumber())
    console.log("Hardcap", poolData.hardcap.toNumber());
    console.log("Softcap", poolData.softcap.toNumber());
    console.log("Raised", poolData.raised.toNumber());
    console.log("Withdraw Amount", poolData.withdrawAmount.toNumber());
    console.log("Pause", poolData.pause);
    console.log("Bump", poolData.bump);
    console.log("")
  })

programCommand('get_contribute_info')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  const {env,keypair} = cmd.opts()
  const owner = loadWalletKey(keypair)
  const conn = new Connection(clusterApiUrl(env))
  const poolAddress = new PublicKey(pool_address)
  const wallet = new anchor.Wallet(Keypair.generate())
  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)
  const [data, bump] = await getContributeInfoAccount(owner.publicKey, pool_address);
  const contributeInfoData = await getContributeInfo(conn, data);
  // console.log(contributeInfoData);
  console.log("============ ContributeInfo Data ===========");
  console.log("Pool : " + contributeInfoData.pool.toBase58())
  console.log("Contributer : " + contributeInfoData.contributer.toBase58())
  console.log("Contribute Start : " + contributeInfoData.contributeStart.toNumber())
  console.log("Contribute Last : " + contributeInfoData.contributeLast.toNumber())
  console.log("Amount : " + contributeInfoData.amount.toNumber())
  console.log("")
})

programCommand('init_contributeinfo')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)
  const rand = Keypair.generate().publicKey;
  const [data, bump] = await getContributeInfoAccount(owner.publicKey, pool_address);
  let transaction = new Transaction()
  transaction.add(program.instruction.initContributeInfo(
    new anchor.BN(bump),
    {
      accounts:{
        owner : owner.publicKey,
        pool : pool_address,
        data : data,
        clock : SYSVAR_CLOCK_PUBKEY,
        systemProgram : SystemProgram.programId
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  console.log("Contribute Account : " + data.toBase58())
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})

programCommand('set_withdrawer')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  // const owner2 = Keypair.fromSecretKey(bs58.decode("eigebi5tVTfHR22FKqC2NgRp3kzmXDdjwJGUkQhGSRTRa7tCvycaftGQcrGJJd5Jyy7TqoRgBkEJ87dtvs6X3Tf"))
  // const wallet2 = new anchor.Wallet(owner2);

  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)

  let transaction = new Transaction()
  transaction.add(program.instruction.setWithdrawer(
    withdrawer,
    {
      accounts:{
        owner : owner.publicKey,
        pool : pool_address
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})

programCommand('set_pause')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  // const owner2 = Keypair.fromSecretKey(bs58.decode("eigebi5tVTfHR22FKqC2NgRp3kzmXDdjwJGUkQhGSRTRa7tCvycaftGQcrGJJd5Jyy7TqoRgBkEJ87dtvs6X3Tf"))
  // const wallet2 = new anchor.Wallet(owner2);

  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)

  let transaction = new Transaction()
  transaction.add(program.instruction.setPause(
    false,
    {
      accounts:{
        owner : owner.publicKey,
        pool : pool_address
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})

programCommand('set_minsol')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  // const owner2 = Keypair.fromSecretKey(bs58.decode("eigebi5tVTfHR22FKqC2NgRp3kzmXDdjwJGUkQhGSRTRa7tCvycaftGQcrGJJd5Jyy7TqoRgBkEJ87dtvs6X3Tf"))
  // const wallet2 = new anchor.Wallet(owner2);

  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)

  let transaction = new Transaction()
  transaction.add(program.instruction.setMinsol(
    new anchor.BN(10000000),
    {
      accounts:{
        owner : owner.publicKey,
        pool : pool_address
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})

programCommand('set_maxsol')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  // const owner2 = Keypair.fromSecretKey(bs58.decode("eigebi5tVTfHR22FKqC2NgRp3kzmXDdjwJGUkQhGSRTRa7tCvycaftGQcrGJJd5Jyy7TqoRgBkEJ87dtvs6X3Tf"))
  // const wallet2 = new anchor.Wallet(owner2);

  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)

  let transaction = new Transaction()
  transaction.add(program.instruction.setMaxsol(
    new anchor.BN(600000000),
    {
      accounts:{
        owner : owner.publicKey,
        pool : pool_address
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})

programCommand('set_softcap')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  // const owner2 = Keypair.fromSecretKey(bs58.decode("eigebi5tVTfHR22FKqC2NgRp3kzmXDdjwJGUkQhGSRTRa7tCvycaftGQcrGJJd5Jyy7TqoRgBkEJ87dtvs6X3Tf"))
  // const wallet2 = new anchor.Wallet(owner2);

  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)

  let transaction = new Transaction()
  transaction.add(program.instruction.setSoftcap(
    new anchor.BN(10),
    {
      accounts:{
        owner : owner.publicKey,
        pool : pool_address
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})

programCommand('set_transfer_authority')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  const owner2 = Keypair.fromSecretKey(bs58.decode("eigebi5tVTfHR22FKqC2NgRp3kzmXDdjwJGUkQhGSRTRa7tCvycaftGQcrGJJd5Jyy7TqoRgBkEJ87dtvs6X3Tf"))
  const wallet2 = new anchor.Wallet(owner2);

  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)

  let transaction = new Transaction()
  transaction.add(program.instruction.transferAuthority(
    owner.publicKey,
    {
      accounts:{
        owner : owner2.publicKey,
        pool : pool_address
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner2], confirmOption)
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})

programCommand('set_hardcap')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  // const owner2 = Keypair.fromSecretKey(bs58.decode("eigebi5tVTfHR22FKqC2NgRp3kzmXDdjwJGUkQhGSRTRa7tCvycaftGQcrGJJd5Jyy7TqoRgBkEJ87dtvs6X3Tf"))
  // const wallet2 = new anchor.Wallet(owner2);

  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)

  let transaction = new Transaction()
  transaction.add(program.instruction.setHardcap(
    new anchor.BN(1000000000),
    {
      accounts:{
        owner : owner.publicKey,
        pool : pool_address
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})

programCommand('deposit')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  // const owner2 = Keypair.fromSecretKey(bs58.decode("eigebi5tVTfHR22FKqC2NgRp3kzmXDdjwJGUkQhGSRTRa7tCvycaftGQcrGJJd5Jyy7TqoRgBkEJ87dtvs6X3Tf"))
  // const wallet2 = new anchor.Wallet(owner2);

  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)

  const [data, bump] = await getContributeInfoAccount(owner.publicKey, pool_address);

  let transaction = new Transaction()
  transaction.add(program.instruction.depositSol(
    new anchor.BN(100000000),
    {
      accounts:{
        owner : owner.publicKey,
        pool : pool_address,
        contributeInfo : data,
        clock : SYSVAR_CLOCK_PUBKEY,
        systemProgram : SystemProgram.programId
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})

programCommand('claim')
.requiredOption(
  '-k, --keypair <path>',
  'Solana wallet location'
)
.action(async (directory,cmd)=>{
  try{
  const {env,keypair,info} = cmd.opts()
  const conn = new Connection(clusterApiUrl(env))
  const owner = loadWalletKey(keypair)
  const wallet = new anchor.Wallet(owner)
  const owner2 = Keypair.fromSecretKey(bs58.decode("eigebi5tVTfHR22FKqC2NgRp3kzmXDdjwJGUkQhGSRTRa7tCvycaftGQcrGJJd5Jyy7TqoRgBkEJ87dtvs6X3Tf"))
  // const wallet2 = new anchor.Wallet(owner2);

  const provider = new anchor.Provider(conn,wallet,confirmOption)
  const program = new anchor.Program(idl,programId,provider)

  let transaction = new Transaction()
  transaction.add(program.instruction.claimSol(
    new anchor.BN(300000000),
    {
      accounts:{
        owner : owner2.publicKey,
        pool : pool_address,
        poolAddress : pool_address,
        // clock : SYSVAR_CLOCK_PUBKEY,
        systemProgram : SystemProgram.programId
      }
    }
  ))
  const hash = await sendAndConfirmTransaction(conn, transaction, [owner2], confirmOption)
  console.log("Transaction ID : " + hash)
  }catch(err){
    console.log(err)
  }
})


function programCommand(name: string) {
  return program
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'devnet',
    )
    .option('-l, --log-level <string>', 'log level', setLogLevel);
}

function setLogLevel(value : any, prev : any) {
  if (value === undefined || value === null) {
    return;
  }
  console.log('setting the log value to: ' + value);
  log.setLevel(value);
}

program.parse(process.argv)