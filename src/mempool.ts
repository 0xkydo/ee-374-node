import { objectManager } from "./object";
import { logger } from "./logger";
import { UTXOSet } from "./utxo";
import { AnnotatedError, TransactionObjectType } from "./message";
import { Transaction } from "./transaction";
import { Block } from "./block";


class Mempool {

  mempoolUTXO: UTXOSet = new UTXOSet(new Set<string>())
  mempool: Transaction[] = []
  allTranscations: Transaction[] = []

  async updateBlockToMempool(_block: Block) {

    if (_block.stateAfter == undefined) {
      throw new AnnotatedError('INTERNAL_ERROR', 'Cannot find block state for the new block in mempool.')
    }

    this.mempoolUTXO = _block.stateAfter;
    this.mempool = []

    for (const txn of this.allTranscations) {
      try {
        await this.mempoolUTXO.apply(txn)
        this.mempool.push(txn)
      } catch { }
    }
  }

  async addTxnToMempool(_transaction: Transaction) {
    await this.mempoolUTXO.apply(_transaction)
    this.mempool.push(_transaction)
    this.allTranscations.push(_transaction)
  }

}

export const mempool = new Mempool()
