import { stat } from "fs";
import { isIP } from "net";
import { z } from 'zod';
const isValidDomain = require('is-valid-domain')

import errors from "../../FIXED_MESSAGES/errors.json"

export default function formatChecker(obj: any): [boolean, any] {

  switch (obj.type) {
    case 'transaction':
      let transactionStatus = transaction.safeParse(obj);
      if(transactionStatus.success){

      }else{
        return [false, errors.INVALID_FORMAT]
      }
      break;
    case 'block':
      let blockStatus = block.safeParse(obj);
      if(blockStatus.success){

      }else{
        return [false, errors.INVALID_FORMAT]
      }
      break;
    case 'hello':
      if (obj.version.slice(0, -1) === "0.9.") {
        return [true, null];
      } else {
        return [false,errors.INVALID_FORMAT];
      }
    case 'error':
      break;
    case 'getpeers':
      break;
    case 'peers':
      // Check if all peers are in valid formats.
      for(var peer of obj.peers){

        // Check if format is correct and only has 1 ":"
        if(peer.split(":").length!==2){
          return [false,errors.INVALID_FORMAT];
        }

        // Parse IP and PORT number.
        var IP = peer.split(":")[0];
        var PORT = Number(peer.split(":")[1]);
        // Check if the IP is IP, and the PORT is number 1-65535.
        if(!isIP(IP) || PORT < 1 || PORT > 65535 ){
          if(!isValidDomain(IP) || PORT < 1 || PORT > 65535){
            return [false,errors.INVALID_FORMAT];
          }
        }
      }
      break;
    case 'getobject':
      break;
    case 'ihaveobject':
      break;
    case 'object':
      let objStatus = object.safeParse(obj);
      if(objStatus.success){

      }else{
        return [false, errors.INVALID_FORMAT]
      }
      break;
    case 'getmempool':
      break;
    case 'mempool':
      break;
    case 'getchaintip':
      break;
    case 'chaintip':
      break;
    default:
      return [false,errors.INVALID_FORMAT];
  }

  return [true,null];

}

// Intermediate types

const hash = z.string().length(64).regex(new RegExp('^[a-z0-9]+$'))

const signature = z.string().length(128).regex(new RegExp('^[a-z0-9]+$'));

const pubkey = z.string().length(64).regex(new RegExp('^[a-z0-9]+$'));

const output = z.object({
  pubkey: pubkey,
  value: z.bigint()
})

const outPoint = z.object({
  txid :hash,
  index: z.number().int().positive()
})

const input = z.object({
  outpoint: outPoint,
  sig: signature
})

const transactionNonCoinbase = z.object({
  type: z.literal('transactions'),
  inputs: z.array(input),
  outputs: z.array(output)
})

const transactionCoinbase = z.object({
  type: z.literal('transaction'),
  height: z.number().int().positive(),
  output: z.array(output).length(1)
})

const block = z.object({
  type: z.literal('block'),
  txids: z.array(hash),
  nonce: z.string().length(64),
  previd: z.string().length(64),
  created: z.number().int().positive(),
  T : z.string()
})

const transaction = z.union([transactionNonCoinbase,transactionCoinbase])

const objectValue = z.discriminatedUnion("type",[
  transactionCoinbase,
  transactionNonCoinbase,
  block
])

const iHaveObject = z.object({
  type: z.literal('ihaveobject'),
  objectid: hash
})

const object = z.object({
  type: z.literal('object'),
  object: objectValue
})


type Transaction = z.infer<typeof transaction>;
type IHaveObject = z.infer<typeof iHaveObject>;
