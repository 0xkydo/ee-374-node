import { logger } from './logger'
import { network } from './network'
import { chainManager } from './chain'
import { mempool } from './mempool'
import { miner } from './miner'
import { AnnotatedError } from './message'

const BIND_PORT = 18018
const BIND_IP = '0.0.0.0'

logger.info(`Malibu - A Marabu node`)
logger.info(`Dionysis Zindros <dionyziz@stanford.edu>`)

async function main() {
  await chainManager.init()
  await mempool.init()
  await miner.init()
  /* send bu
   let txID = ... tx id is coinbase tx of block we mined (or can do multiple if not enough)
   let signature ... signature of tx
   await miner.sendBUPayment(txID, signature)
  */
  await network.init(BIND_PORT, BIND_IP)
  miner.mine()
}

main()
