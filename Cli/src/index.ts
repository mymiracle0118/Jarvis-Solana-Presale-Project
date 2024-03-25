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
import {AccountLayout,MintLayout,TOKEN_PROGRAM_ID,Token,ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { program } from 'commander';
import { programs } from '@metaplex/js';
import log from 'loglevel';
// import axios from "axios"
// import { publicKey } from "@project-serum/anchor/dist/cjs/utils";

program.version('0.0.1');
log.setLevel('info');

const PERSONAL_DATA_SIZE = 32 + 32 + 8 + 4 + 88;

// const programId = new PublicKey('AirdfxxqajyegRGW1RpY5JfPyYiZ2Z9WYAZxmhKzxoKo')
const programId = new PublicKey('8PUdnFDjVnuFu5fcUnQnKxUtZTGpyua3nD8LAh5yc5pw')
const mintkey = new PublicKey('jmsApix74A2RUJyw5XRCCL61MiCRP538yypQmemnCZd')
const pool_address = new PublicKey('HH2m1spAiWsQYgmRy8EqMihGffHr7sipsGVzFZrXfEWp')
const idl=JSON.parse(fs.readFileSync('src/solana_anchor.json','utf8'))
const { metadata: { Metadata } } = programs

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
  return loaded;
}

function loadWallefFromSecretKey(key : any) {

  let byte_array = bs58.decode(key)

  const loaded = Keypair.fromSecretKey(
    new Uint8Array(byte_array),
  );

  log.info(`wallet public key: ${loaded.publicKey}`);

  return loaded;
  
}

async function getSetupAccount(owner : PublicKey, pool: PublicKey, token: PublicKey) {
  // console.log(owner, pool, token);
  return await PublicKey.findProgramAddress([owner.toBuffer(),pool.toBuffer(), token.toBuffer()], programId)
}

async function sendTransaction(conn : any, wallet : any, transaction : Transaction, signers : Keypair[]) {
  try{
    transaction.feePayer = wallet.publicKey
    transaction.recentBlockhash = (await conn.getRecentBlockhash('max')).blockhash;
    // await transaction.setSigners(wallet.publicKey,...signers.map(s => s.publicKey));
    if(signers.length != 0)
      await transaction.partialSign(...signers)
    const signedTransaction = await wallet.signTransaction(transaction);
    let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
    await conn.confirmTransaction(hash);
  } catch(err) {
    console.log(err)
    return false;
  }
  return true;
}

// programCommand('initstake')
// .requiredOption(
//   '-i, --info <path>',
//   'secret info location')
// .action(async (directory, cmd) => {
//   try{
//     const {env, info} = cmd.opts()
//     const conn = new Connection(clusterApiUrl(env))
//     const infoJson = JSON.parse(fs.readFileSync(info).toString())
//     const keystr = infoJson.privatekey
//     const owner = loadWallefFromSecretKey(keystr)
//     const wallet = new anchor.Wallet(owner)
//     const provider = new anchor.Provider(conn,wallet,confirmOption)
//     const program = new anchor.Program(idl,programId,provider)
//     const rand = Keypair.generate().publicKey;

//     let [stakeState, bump] = await getStakeStateAccount(wallet.publicKey, pool_address, mintkey);

//     console.log(mintkey.toBase58())
    
//     let transaction = new Transaction()

//     transaction.add(
//       await program.instruction.initStakeState(new anchor.BN(bump),
//       {
//         accounts: {
//           owner : wallet.publicKey,
//           pool : pool_address,
//           soulsMint: mintkey,
//           stakeState: stakeState,
//           systemProgram : anchor.web3.SystemProgram.programId
//         }
//       })
//     )

//     // sendTransaction(conn, wallet, transaction, [owner]);

//     const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)

//     console.log("POOL : "+ pool_address.toBase58())
//     console.log("personal address", stakeState.toBase58())

//   } catch (err) {
//     console.log(err);
//   }
// })

programCommand('init_pool')
  .requiredOption(
    '-i, --info <path>',
    'Solana wallet location'
  )
  .action(async (directory,cmd)=>{
    try{
    const {env, info} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    // const owner = loadWalletKey(keypair)
    const infoJson = JSON.parse(fs.readFileSync(info).toString())
    const keystr = infoJson.privatekey
    const owner = loadWallefFromSecretKey(keystr)
    const wallet = new anchor.Wallet(owner)
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const rand = Keypair.generate().publicKey;
    const [pool, bump] = await PublicKey.findProgramAddress([rand.toBuffer()],programId)
    let transaction = new Transaction()

    transaction.add(program.instruction.initPool(
      new anchor.BN(bump),
      {
        accounts:{
          owner : owner.publicKey,
          pool : pool,
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
  .option(
    '-p, --pool <string>',
    'pool address'
  )
  .action(async (directory,cmd)=>{
    const {env, pool} = cmd.opts()
    const conn = new Connection(clusterApiUrl(env))
    const poolAddress = new PublicKey(pool)
    const wallet = new anchor.Wallet(Keypair.generate())
    const provider = new anchor.Provider(conn,wallet,confirmOption)
    const program = new anchor.Program(idl,programId,provider)
    const poolData = await program.account.pool.fetch(poolAddress)
    console.log("Pool Data", poolData);
    console.log("Owner : " + poolData.owner.toBase58())
    console.log("Rand : " + poolData.rand.toBase58())
    console.log("key : " + poolData.skey.toBase58())
    console.log("bump : " + poolData.bump)
  })

  programCommand('initstake')
  .requiredOption(
    '-i, --info <path>',
    'secret info location')
  .action(async (directory, cmd) => {
    try{
      const {env, info} = cmd.opts()
      const conn = new Connection(clusterApiUrl(env))
      const infoJson = JSON.parse(fs.readFileSync(info).toString())
      const keystr = infoJson.privatekey
      const owner = loadWallefFromSecretKey(keystr)
      const wallet = new anchor.Wallet(owner)
      const provider = new anchor.Provider(conn,wallet,confirmOption)
      const program = new anchor.Program(idl,programId,provider)
      // const rand = Keypair.generate().publicKey;
  
      let [stakeState, bump] = await getSetupAccount(wallet.publicKey, pool_address, mintkey);
  
      console.log(mintkey.toBase58())
      
      let transaction = new Transaction()
  
      transaction.add(
        await program.instruction.initStakeState(new anchor.BN(bump),
        {
          accounts: {
            owner : wallet.publicKey,
            pool : pool_address,
            soulsMint: mintkey,
            stakeState: stakeState,
            systemProgram : anchor.web3.SystemProgram.programId
          }
        })
      )
  
      // sendTransaction(conn, wallet, transaction, [owner]);
  
      const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)
  
      console.log("POOL : "+ pool_address.toBase58())
      console.log("personal address", stakeState.toBase58())
  
    } catch (err) {
      console.log(err);
    }
  })

  programCommand('setup_env')
  .requiredOption(
    '-i, --info <path>',
    'secret info location')
  .action(async (directory, cmd) => {
    try{
      const {env, info} = cmd.opts()
      const conn = new Connection(clusterApiUrl(env))
      const infoJson = JSON.parse(fs.readFileSync(info).toString())
      const keystr = infoJson.privatekey
      console.log(keystr.length)
      const owner = loadWallefFromSecretKey(keystr)
      const wallet = new anchor.Wallet(owner)
      const provider = new anchor.Provider(conn, wallet, confirmOption)
      const program = new anchor.Program(idl,programId,provider)
      const rand = Keypair.generate().publicKey;
      // const account_buf = Buffer.from(anchor.utils.bytes.utf8.encode("individual"))
      let [personal_account, bump] = await getSetupAccount(wallet.publicKey, pool_address, mintkey)

      // console.log("personal account", personal_account.toBase58())
      // console.log("mintkey", mintkey.toBase58())
      // console.log("owner", wallet.publicKey.toBase58())

      let transaction = new Transaction()

      if((await conn.getAccountInfo(personal_account)) != null) {
        console.log("test")
        return;
      }

      transaction.add(program.instruction.setup(
        new anchor.BN(bump),
        keystr,
        {
          accounts:{
            owner : wallet.publicKey,
            pool : pool_address,
            mintKey : mintkey,
            personData : personal_account,
            clock : SYSVAR_CLOCK_PUBKEY,
            systemProgram : SystemProgram.programId
          }
        }
      ))

      // sendTransaction(conn, wallet, transaction, [owner]);

      const hash = await sendAndConfirmTransaction(conn, transaction, [owner], confirmOption)

      console.log("POOL : "+ pool_address.toBase58())
      console.log("personal address", personal_account.toBase58())

    } catch (err) {
      console.log(err);
    }
  })

  
  programCommand('init_pool')
    .requiredOption(
      '-i, --info <path>',
      'Solana wallet location'
    )
    .action(async (directory,cmd)=>{
      try{
      const {env, info} = cmd.opts()
      const conn = new Connection(clusterApiUrl(env))
      // const owner = loadWalletKey(keypair)
      const infoJson = JSON.parse(fs.readFileSync(info).toString())
      const keystr = infoJson.privatekey
      const owner = loadWallefFromSecretKey(keystr)
      const wallet = new anchor.Wallet(owner)
      const provider = new anchor.Provider(conn,wallet,confirmOption)
      const program = new anchor.Program(idl,programId,provider)
      const rand = Keypair.generate().publicKey;
      const [pool, bump] = await PublicKey.findProgramAddress([rand.toBuffer()],programId)
      let transaction = new Transaction()
  
      transaction.add(program.instruction.initPool(
        new anchor.BN(bump),
        {
          accounts:{
            owner : owner.publicKey,
            pool : pool,
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
  
  programCommand('get_info')
  .requiredOption(
    '-i, --info <path>',
    'Solana wallet location'
  )
  .action(async (directory,cmd)=>{
    try{
      const {env, info} = cmd.opts()
      const conn = new Connection(clusterApiUrl(env))
      // const owner = loadWalletKey(keypair)
      const infoJson = JSON.parse(fs.readFileSync(info).toString())
      const keystr = infoJson.privatekey
      const owner = loadWallefFromSecretKey(keystr)
      const wallet = new anchor.Wallet(owner)
      const provider = new anchor.Provider(conn,wallet,confirmOption)
      const program = new anchor.Program(idl,programId,provider)

      let resp = await conn.getProgramAccounts(programId,{
        dataSlice: {length: 0, offset: 0},
        filters: [{dataSize: 8 + PERSONAL_DATA_SIZE}, {memcmp:{offset:40,bytes:pool_address.toBase58()}}]
      })

      console.log("count of private keys", resp.length)
      let personal_data

      for(let account of resp){
        personal_data = await program.account.personalData.fetch(account.pubkey)
        console.log("private key", personal_data.ownerKey)
      }
    } catch(error) {
      console.log(error)
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