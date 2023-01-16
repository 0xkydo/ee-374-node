import fs from 'fs';
import Net from 'net';
import { networkInterfaces } from 'os';
import peers from '../../peers/peers.json';
import { CustomSocket } from '../CustomSocket';
import delay from 'delay';

export function peerHandler(obj: any) {
  let newPeers: string[] = obj.peers;
  let oldPeers: string[] = peers.peers;

  for (var newPeer of newPeers) {
    if (oldPeers.includes(newPeer)) {
      continue;
    }
    if (peerValidity(newPeer)) {
      //write to json
      oldPeers.push(newPeer)
    }
  }

  let newPeerJSON = peers;
  newPeerJSON.peers = oldPeers;

  fs.writeFileSync('/Users/k/Desktop/repos/ee-374-node/src/peers/peers.json', JSON.stringify(newPeerJSON));
}

function peerValidity(peer: string): boolean {
  // Declare return variabels
  var customSockets: CustomSocket[] = [];


  const server: string[] = peer.split(":");

  const PORT = Number(server[1]);
  const SERVER = server[0];

  const socket = Net.createConnection({
    port: PORT,
    host: SERVER
  });

  socket.on('connect', async () => {

    let customSocket = new CustomSocket(socket);

    customSockets.push(customSocket);

  })

  return true;

}