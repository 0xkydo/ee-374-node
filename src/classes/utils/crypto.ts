import blake2 from 'blake2';

// @notice input is string only.
// Output hexified hash digest.
export default function blake2s(data: string): string{
  // Create blake2s hash algo
  let hash = blake2.createHash('blake2s');
  // Hash
  hash.update(Buffer.from(data));
  
  return hash.digest('hex');
  
}