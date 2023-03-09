import { TARGET, BLOCK_REWARD, BU, Block } from './block'
import { Transaction } from './transaction'
import { BlockObject, BlockObjectType,
         TransactionObject, TransactionOutputObjectType, ObjectType, AnnotatedError, ErrorChoice } from './message'
import { hash } from './crypto/hash'
import { canonicalize } from 'json-canonicalize'
import { objectManager, ObjectId, db } from './object'
import { mempool } from './mempool'
import { logger } from './logger'
import { chainManager } from './chain'
import { network } from './network'

class Miner {
  PK = ""
  BENCHMARK_FREQ = 10 // 10 seconds
  isBenchmarkingHashRate = true

  async init(){
    // Begin mining w/o reorg
    await mine();
  }

  async mine() {
    // Create coinbase transaction object
    const coinbase: TransactionObjectType = {
      type: 'transaction',
      outputs: [{
        pubkey: PK,
        value: BLOCK_REWARD
      }],
      height: chainManager.longestChainHeight() + 1
    }

    // Get transactions from mempool
    const txids = await db.get('mempool:txids')

    logger.debug(`Miner retrieved cached mempool: ${txids}.`)

    // Create block object
    const block: BlockObjectType = {
      type: 'block',
      previd: chainManager.longestChainTip().blockid,
      txids: [objectManager.id(coinbase)].push(txids),
      T: TARGET,
      created: Math.floor(new Date().getTime() / 1000),
      miner: 'Su and Kyle',
      note: 'Making it all back block by block',
      studentids: ["jchudnov", "kydo"],
    }

    if(isBenchmarkingHashRate) logger.debug(`Starting to compute hashes at timestamp ${Math.floor(new Date().getTime() / 1000)}`)

    // Performs PoW by calculating hashes
    this.computeHashes(obj);

    if(isBenchmarkingHashRate) logger.debug(`Ended computing hashes at timestamp ${Math.floor(new Date().getTime() / 1000)}`)

    logger.debug(`Block being mined with nonce ${block.nonce} and coinbase tx id ${objectManager.id(coinbase)}`)

    // validate block (for debugging)
    // await b.validate()

    // Gossip coinbase transaction
    network.broadcast({
      type: 'object',
      coinbase
    })

    // Gossip new block
    network.broadcast({
      type: 'object',
      block
    })

    // Save coinbase tx and block in db
    await objectManager.put(coinbase)
    await objectManager.put(block)

    // save block
    await b.save()
  }

  // Computes the hashes
  computeHashes(obj: BlockObjectType): number{
    let nonce: number = 0
    let prevNonce: number = 0

    let currTimestamp = Math.floor(new Date().getTime() / 1000)

    while(true){
      obj.nonce = nonce.toString(16).padStart(64, '0')
      if (this.hasPoW(hash(canonicalize(obj)))){
        return nonce
      }

      // Check hashrate
      if(isBenchmarkingHashRate && (Math.floor(new Date().getTime() / 1000) - currTimestamp == BENCHMARK_FREQ)){
        logger.debug(`Hashrate: ${(nonce - prevNonce) / BENCHMARK_FREQ} h/s`)
        prevNonce = nonce
        currTimestamp = (Math.floor(new Date().getTime() / 1000)
      }
      nonce += 1
    }
  }

  hasPoW(id): boolean {
    return BigInt(`0x${id}`) <= BigInt(`0x${TARGET}`)
  }

  async sendBUPayment(txID, sig){
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
      height: chainManager.longestChainHeight() + 1
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
