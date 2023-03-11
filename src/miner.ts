// I/O
import fs from 'fs';
import process from 'process';

// Processes
import * as child_process from 'child_process';

import { TARGET, BLOCK_REWARD, BU, Block } from './block'
import { Transaction } from './transaction'
import {
  BlockObject, BlockObjectType,
  TransactionObject, TransactionObjectType, ObjectType, AnnotatedError, ErrorChoice
} from './message'
import { hash } from './crypto/hash'
import { canonicalize } from 'json-canonicalize'
import { objectManager, ObjectId, db } from './object'
import { mempool } from './mempool'
import { logger } from './logger'
import { chainManager } from './chain'
import { network } from './network'
import path from 'path';

const MAX_TXN_LEN = 50000

const filePath = `./a_mine2.out`;
const filePathAbs = path.resolve(filePath);

class Miner {
  PK = "f7c6335811ac0f4b207081025e3d21144c13d3b3e9c4a322ecc7cfabb231a4a0"
  NAME = 'Su and Kyle'
  NOTE = 'Making it all back block by block'
  isMining = false;
  child: child_process.ChildProcessWithoutNullStreams | undefined

  async createTxn() {

    var sampleCoinbaseTxn = {
      "type": "transaction",
      "height": 1,
      "outputs": [
        {
          "pubkey": "f7c6335811ac0f4b207081025e3d21144c13d3b3e9c4a322ecc7cfabb231a4a0",
          "value": 50000000000000
        }
      ]
    }

    for (var i = 0; i < MAX_TXN_LEN; i++) {
      await db.put(`t3ac_${sampleCoinbaseTxn.height}`, sampleCoinbaseTxn);
      sampleCoinbaseTxn.height++;
    }

  }

  // Store prefix and suffix into local txt file.
  storePrefixSuffix(text: string, prefix: boolean) {
    // If it is prefix
    if (prefix) {
      fs.writeFileSync(`prefix.txt`, text, { encoding: 'utf8' });
    }
    else {
      fs.writeFileSync(`suffix.txt`, text, { encoding: 'utf8' });
    }
  };

  //
  async waitForMining(child: child_process.ChildProcess) {
    return new Promise<void>((resolve, reject) => {
      child.on('exit', (code) => {
        console.log(`HASH FOUND`);
        resolve();
      });
    });
  }

  async init() {

    await this.createTxn()

  }

  async mine() {

    // Get transactions from mempool
    const txids = await db.get('mempool:txids')

    logger.info(`Miner retrieved cached mempool: ${txids}.`)

    const tipHeight = chainManager.longestChainHeight;
    const coinbase = await db.get(`t3ac_${tipHeight + 1}`)

    await objectManager.put(coinbase)

    logger.debug(`Miner retrieved new coinbase txn at ${tipHeight}`)

    if (chainManager.longestChainTip == null) {
      logger.debug(`Chain Manager is not well initiated.`)
      return
    }

    // Create block object
    const block: BlockObjectType = {
      type: 'block',
      previd: chainManager.longestChainTip.blockid,
      txids: [objectManager.id(coinbase).toString()].concat(txids),
      T: TARGET,
      created: Math.floor(new Date().getTime() / 1000),
      miner: this.NAME,
      note: this.NOTE,
      studentids: ["jchudnov", "wweng"],
      nonce: ""
    }

    // Performs PoW by calculating hashes
    await this.computeHashes(block);

    logger.info(`Block being mined with nonce ${block.nonce} and coinbase tx id ${objectManager.id(coinbase)}`)

    await objectManager.put(block)

    // validate block (for debugging)
    // await b.validate()

    // Gossip new block
    network.broadcast({
      type: 'object',
      object: block
    })


    // Save coinbase tx and block in db
    await objectManager.put(coinbase)
    await objectManager.put(block)

    // save block
    await (new Block(block.previd,
      block.txids,
      block.nonce,
      block.T,
      block.created,
      block.miner,
      block.note,
      block.studentids)).save()
  }

  // Computes the hashes
  async computeHashes(obj: BlockObjectType) {

    if (this.isMining == true && this.child !== undefined) {
      this.child?.kill('SIGKILL')
      this.child = undefined;
      logger.debug(`Old child process eliminated`)
    }

    this.isMining = true

    var block_splitted = canonicalize(obj).split(`"nonce":"`);
    var prefix = block_splitted[0] + `"nonce":"`;
    var suffix = block_splitted[1];

    this.storePrefixSuffix(prefix, true);
    this.storePrefixSuffix(suffix, false);

    logger.debug(`Child process started`)

    this.child = child_process.spawn(filePathAbs);

    this.child.stdout.on('data', (data) => {

      const dataArray = data.toString().split('\n');
      obj.nonce = dataArray[0];

    });

    this.child.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    this.child.on('close', (code) => {
      // console.log(`child process exited with code ${code}`);
    });

    await this.waitForMining(this.child);

    logger.debug(`PoW hash found.`)

    logger.debug(`Child process resetted`)

    this.child = undefined
    this.isMining = false

  }

  hasPoW(id: any): boolean {
    return BigInt(`0x${id}`) <= BigInt(`0x${TARGET}`)
  }

  async sendBUPayment(txID: string, sig: string) {
    // Create payment
    const payment: TransactionObjectType = {
      type: 'transaction',
      inputs: [{
        outpoint: {
          "txid": txID,
          "index": 0
        },
        "sig": sig
      }],
      outputs: [{
        pubkey: "0x3f0bc71a375b574e4bda3ddf502fe1afd99aa020bf6049adfe525d9ad18ff33f",
        value: 50 * BU
      }],
    }

    // Gossip payment
    network.broadcast({
      type: 'object',
      payment
    })

    // Save payment in db
    await objectManager.put(payment)
  }
}

export const miner = new Miner()
