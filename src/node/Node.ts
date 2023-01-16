// Import Libraries
import { MarabuNode } from '../classes/MarabuNode';
import peers from '../peers/peers.json'

// The port on which the server is listening.
const PORT = 18018;

let node = new MarabuNode(PORT);

for(var peer of peers.peers){
  const address = peer.split(":");
  const IP = address[0];
  const PORT = Number(address[1]);

  node.connectToNode(IP,PORT);
}