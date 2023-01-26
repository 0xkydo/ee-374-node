// For blake2s
import blake2 from 'blake2';
// Import ed25519
import * as ed from '@noble/ed25519';
// Change ed25519 to synchronous mode
import { sha512 } from '@noble/hashes/sha512';
ed.utils.sha512Sync = (...m) => sha512(ed.utils.concatBytes(...m));
// Export synchronous verify method
const {verify} = ed.sync;

// @notice input is string only.
// Output hexified hash digest.
export function blake2s(data: string): string{
  // Create blake2s hash algo
  let hash = blake2.createHash('blake2s');
  // Hash
  hash.update(Buffer.from(data));
  
  return hash.digest('hex');
  
}

export function batchSigVerifier(message: string | Uint8Array, pubkeyArray: string[], sigArray: string[]): boolean{

  // Iterate through all pk-sig pairs and check if it correctly signs the message.
  for(var i = 0; i< pubkeyArray.length;i++){
    if(verify(sigArray[i],message,pubkeyArray[i])){

    }else{
      return false;
    }
  }
  return true;

}