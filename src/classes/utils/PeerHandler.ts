import fs from 'fs';
import Net from 'net';
import { networkInterfaces } from 'os';
import peers from '../../peers/peers.json';
import { CustomSocket } from '../CustomSocket';
import { setTimeout } from 'timers/promises';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function peerHandler(obj: any) {
  let newPeers: string[] = obj.peers;
  let oldPeers: string[] = peers.peers;

  for (var newPeer of newPeers) {
    if (oldPeers.includes(newPeer)) {
      continue;
    }
    var isValidPeer: boolean = peerValidity(newPeer);
    console.log(isValidPeer);

    if(isValidPeer){
      //write to json
      oldPeers.push(newPeer)
    }
  }

  let newPeerJSON = peers;
  newPeerJSON.peers = oldPeers;

  fs.writeFileSync('../../peers/peers.json', JSON.stringify(newPeerJSON));
}

function peerValidity(peer: string): boolean {
  // Declare return variabels
  var latency: number = 0;
  var isSuccess: boolean = false;

  const server: string[] = peer.split(":");

  const PORT = Number(server[1]);
  const SERVER = server[0];

  const socket = new CustomSocket(Net.createConnection({
    port: PORT,
    host: SERVER
  }));

  // await sleep(4000);

  return socket.handShakeCompleted;
}
