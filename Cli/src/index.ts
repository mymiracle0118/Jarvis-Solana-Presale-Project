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
// import { programs } from '@metaplex/js';
import log from 'loglevel';
import axios from "axios"
import { publicKey } from "@project-serum/anchor/dist/cjs/utils";

program.version('0.0.1');
log.setLevel('info');

// const programId = new PublicKey('AirdfxxqajyegRGW1RpY5JfPyYiZ2Z9WYAZxmhKzxoKo')
const programId = new PublicKey('presniX9hhdaCKFXD6fkmEs5cNuL6GWmtjAz6u87NMz')
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
const pool_address = new PublicKey('BsRHBE5SKCaai8bJzGqmt7Xs8nkj6rNECRim8LUdBzkN')
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
  log.info(`wallet public key: ${bs58.encode(loaded.secretKey)}`)
  return loaded;
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
    console.log(poolData);
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

//   programCommand('get_nft')
//   .option(
//     '-k, --keypair <path>',
//     'keypair path'
//   ).action(async (directory,cmd)=>{
//     const {env, keypair} = cmd.opts()
//     const conn = new Connection(clusterApiUrl(env))
//     const owner = loadWalletKey(keypair)
//     // const provider = new anchor.Provider(conn,owner,confirmOption)

//     const allTokens: any = []
//     const tokenAccounts = await conn.getParsedTokenAccountsByOwner(owner.publicKey, {
//       programId: TOKEN_PROGRAM_ID
//     });

//     for (let index = 0; index < tokenAccounts.value.length; index++) {
//       try{
//         const tokenAccount = tokenAccounts.value[index];
//         const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;
//         if (tokenAmount.amount == "1" && tokenAmount.decimals == "0") {
//           let nftMint = new PublicKey(tokenAccount.account.data.parsed.info.mint)
//           let [pda] = await anchor.web3.PublicKey.findProgramAddress([
//             Buffer.from("metadata"),
//             TOKEN_METADATA_PROGRAM_ID.toBuffer(),
//             nftMint.toBuffer(),
//           ], TOKEN_METADATA_PROGRAM_ID);
//           const accountInfo: any = await conn.getParsedAccountInfo(pda);
//           let metadata : any = new Metadata(owner.publicKey.toString(), accountInfo.value);
//           console.log("test meatadata", metadata.data.data)
//           const { data }: any = await axios.get(metadata.data.data.uri)
//           console.log("nft get data", data)
//           if (true) {
//             const entireData = { ...data, id: Number(data.name.replace( /^\D+/g, '').split(' - ')[0]) }
//             console.log("nft data", entireData);
//             console.log("hvh type",entireData.attributes[0].value)
//             allTokens.push({account_address : tokenAccount.pubkey, mint_address : nftMint, ...entireData, mname : metadata.data.data.name })
//           }
//         }
//         allTokens.sort(function (a: any, b: any) {
//           if (a.name < b.name) { return -1; }
//           if (a.name > b.name) { return 1; }
//           return 0;
//         })
//       } catch(err) {
//         continue;
//       }
//     }

//     console.log("")
//   })

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