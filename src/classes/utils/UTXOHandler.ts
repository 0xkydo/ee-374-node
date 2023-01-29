import fs from 'fs'
import { canonicalize } from 'json-canonicalize';
import path from 'path'

const UTXOPath = path.resolve(__dirname, '../../UTXO/UTXOSET.json');
var UTXOSET = JSON.parse(fs.readFileSync(UTXOPath, 'utf8'));

export function returnUTXO(blockid: string): string[]{

  return UTXOSET[blockid];

}

export function addUTXOSet(blockid: string, txids: string[]){

  UTXOSET[blockid] = txids;

  fs.writeFileSync(UTXOPath,canonicalize(UTXOSET));
  
  return
}