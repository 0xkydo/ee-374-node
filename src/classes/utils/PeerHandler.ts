import fs from 'fs';
import Net from 'net';
import { networkInterfaces } from 'os';
import peers from '../../peers/peers.json';
import { CustomSocket } from '../CustomSocket';
import { setTimeout } from 'timers/promises';

export function peerHandler(obj: any) {
  let newPeers: string[] = obj.peers;
  let oldPeers: string[] = peers.peers;

  for (var newPeer of newPeers) {
    if (oldPeers.includes(newPeer)) {
      continue;
    }
    var peerTest: [number, boolean] =  peerValidity(newPeer);
    console.log(peerTest);
  }
}

function peerValidity(peer: string): [number, boolean] {
  // Declare return variabels
  var latency: number = 0;
  var isSuccess: boolean = false;

  const server: string[] = peer.split(":");

  const PORT = Number(server[1]);
  const SERVER = server[0];

  const startTime = Date.now();

  const socket = Net.createConnection({
    port: PORT,
    host: SERVER
  });

  socket.on("connect", () => {
    const endTime = Date.now();
    latency = endTime - startTime;

    socket.on('data', (data) => {
      

    });

    socket.on("end", () => {
      console.log(`Disconnected from ${SERVER}:${PORT}`);
    });
  });


  // Get the current time before connecting

  console.log(`Connecting to: ${SERVER}:${PORT}`)


  return [latency, isSuccess];

}

