import { isIP } from "net";
import { z } from 'zod';
const isValidDomain = require('is-valid-domain')

import errors from "../../FIXED_MESSAGES/errors.json"

export default function formatChecker(obj: any): [boolean, any] {

  switch (obj.type) {
    case 'transaction':
      return [false, errors.INVALID_FORMAT]
    case 'block':
      return [false, errors.INVALID_FORMAT]
    case 'hello':
      var helloStatus = hello.safeParse(obj);
      if (helloStatus.success) {
        return [true, null];
      } else {
        return [false, errors.INVALID_FORMAT];
      }
    case 'error':
      break;
    case 'getpeers':
      break;
    case 'peers':
      // Check if all peers are in valid formats.
      for (var peer of obj.peers) {

        // Check if format is correct and only has 1 ":"
        if (peer.split(":").length !== 2) {
          return [false, errors.INVALID_FORMAT];
        }

        // Parse IP and PORT number.
        var IP = peer.split(":")[0];
        var PORT = Number(peer.split(":")[1]);
        // Check if the IP is IP, and the PORT is number 1-65535.
        if (!isIP(IP) || PORT < 1 || PORT > 65535) {
          if (!isValidDomain(IP) || PORT < 1 || PORT > 65535) {
            return [false, errors.INVALID_FORMAT];
          }
        }
      }
      break;
    case 'ihaveobject':
      let iHaveObjStatus = iHaveObject.safeParse(obj);
      if (iHaveObjStatus.success) {

      } else {
        return [false, errors.INVALID_FORMAT];
      }
      break;
    case 'getobject':
      var getObjStatus = getObject.safeParse(obj);
      if (getObjStatus.success) {

      } else {
        return [false, errors.INVALID_FORMAT];
      }
      break
    case 'object':
      // Check if the the object is a transaction or a block.
      if (obj.object.type == 'transaction') {

        // Check transaction format.
        let transactionStatus = transaction.safeParse(obj.object);

        if (transactionStatus.success) {

          return [true, null];

        } else {
          return [false, errors.INVALID_FORMAT]
        }
      } else {

        // Check if it is genesis block

        let isGensis = genesisBlock.safeParse(obj.object);
        if(isGensis.success){
          return [ true, null];
        }

        // Check block format.
        let blockStatus = block.safeParse(obj.object);

        if (blockStatus.success) {

          return [true, null];

        } else {

          return [false, errors.INVALID_FORMAT]
        }
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
      return [false, errors.INVALID_FORMAT];
  }

  return [true, null];

}

// Intermediate types

// Text
const hash = z.string().length(64).regex(new RegExp('^[a-z0-9]+$'))

const signature = z.string().length(128).regex(new RegExp('^[a-z0-9]+$'));

const pubkey = z.string().length(64).regex(new RegExp('^[a-z0-9]+$'));

const genericText = z.string().max(128); // For student ID, note, miner inside block.

const output = z.object({
  pubkey: pubkey,
  value: z.number().int().nonnegative()
})

const outPoint = z.object({
  txid: hash,
  index: z.number().int().nonnegative()
})

const input = z.object({
  outpoint: outPoint,
  sig: signature
})

export const transactionNonCoinbase = z.object({
  type: z.literal('transaction'),
  inputs: z.array(input),
  outputs: z.array(output)
})

export const transactionCoinbase = z.object({
  type: z.literal('transaction'),
  height: z.number().int().nonnegative(),
  outputs: z.array(output).length(1)
})

// Whole objects

const hello = z.object({
  type: z.literal('hello'),
  version: z.string().regex(new RegExp('^0\.9\.[0-9]$')),
  agent: genericText
})

const block = z.object({
  type: z.literal('block'),
  txids: z.array(hash),
  nonce: hash,
  previd: hash,
  created: z.number().int().nonnegative(),
  T: z.literal('00000000abc00000000000000000000000000000000000000000000000000000'),
  miner: genericText.optional(),
  note: genericText.optional(),
  studentids: z.array(genericText).max(10).optional()
})

export const genesisBlock = z.object({
  type: z.literal('block'),
  txids: z.array(hash).length(0),
  nonce: z.literal("000000000000000000000000000000000000000000000000000000021bea03ed"),
  previd: z.null(),
  created: z.number().int().nonnegative(),
  T: z.literal('00000000abc00000000000000000000000000000000000000000000000000000'),
  note: z.literal("The New York Times 2022-12-13: Scientists Achieve Nuclear Fusion Breakthrough With Blast of 192 Lasers"),
  miner: z.literal("Marabu")
})


export const transaction = z.union([transactionNonCoinbase, transactionCoinbase])

const iHaveObject = z.object({
  type: z.literal('ihaveobject'),
  objectid: hash
})

const getObject = z.object({
  type: z.literal('getobject'),
  objectid: hash
})

type Transaction = z.infer<typeof transaction>;
type IHaveObject = z.infer<typeof iHaveObject>;
