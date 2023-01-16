import fs from 'fs';
import Net from 'net';
import path from "path";
import delay from 'delay';

import { CustomSocket } from '../CustomSocket';
import { networkInterfaces } from 'os';

var socketValidity: boolean = false;
var socketAddress: string = "";

var testingPath = path.resolve(__dirname, '../../peers/testing.json');
var peersPath = path.resolve(__dirname, '../../peers/peers.json');

export function setPeersHandler(obj: any) {

  // Read current peer and testing peer list.
  let testing = JSON.parse(fs.readFileSync(testingPath, 'utf8'));
  let peers = JSON.parse(fs.readFileSync(peersPath, 'utf8'));

  // Extract JSON objects's peers into arrays.
  let newPeers: string[] = obj.peers;
  let oldPeers: string[] = peers.peers;
  let testingPeers: string[] = testing.peers;

  // Loop through all peers in the peers message.
  for (var newPeer of newPeers) {

    // If the new peer is already in file or currenting being tested, skip.
    if (oldPeers.includes(newPeer) || testingPeers.includes(newPeer)) {
      console.log(`Peer already in list: ${newPeer}`)
      continue;
    }

    // If detect a new peer that's not in testing or stored in peers.json, first add the peer to testing file.
    console.log(`New peer detected: ${newPeer}`)
    testingPeers.push(newPeer);
    let newTestingJSON = testing;
    newTestingJSON.peers = testingPeers;
    fs.writeFileSync(testingPath, JSON.stringify(newTestingJSON));

    peerValidityTest(newPeer).then(() => {
      console.log(`Peer Validity Test Finished.`)
    });

  }

}

// Add peer to peers.json file.
function addPeer(newPeer: string) {

  // Re-read the peers.json and testing file to track any changes during looped validity tests.
  let peers = JSON.parse(fs.readFileSync(peersPath, 'utf8'));

  // Extract JSON objects's peer list into arrays.
  let oldPeers: string[] = peers.peers;

  // If the new peer is a valid new peer, add to oldpeer list.
  oldPeers.push(newPeer);

  // Update the peers json file.
  let newPeerJSON = peers;
  newPeerJSON.peers = oldPeers;
  fs.writeFileSync(peersPath, JSON.stringify(newPeerJSON));

}

// TODO serious problem within this portion but seems to be working now.
function removeFromTesting(newPeer: string) {

  console.log(`remove Called`)

  // Re-read the peers.json and testing file to track any changes during looped validity tests.
  let testing = JSON.parse(fs.readFileSync(testingPath, 'utf8'));

  // Extract JSON objects's peer list into arrays.
  let testingPeers: string[] = testing.peers;
  console.log(`pre filter`+testingPeers)

  // Remove the current peer from the testing list.
  testingPeers = testingPeers.filter((peer) => { peer !== newPeer });

  console.log(`post filter: ${testingPeers}`);
  // Update the testing peer file.
  let newTestingJSON = testing;
  newTestingJSON.peers = testingPeers;
  fs.writeFileSync(testingPath, JSON.stringify(newTestingJSON));

}

async function peerValidityTest(peer: string) {

  const node: string[] = peer.split(":");

  const PORT = Number(node[1]);
  const NODE = node[0];

  console.log(`Attempting to connect to ${NODE}:${PORT}`)

  let socket = Net.createConnection({
    port: PORT,
    host: NODE
  });

  socket.on('connect', async () => {
    // On socket connection, initiate Marabu protocol by wrapping the socket.
    let customSocket = new CustomSocket(socket);
    customSocket.on('data', (data) => { });

    // Wait 1.5 second for initial handshake to complete.
    await delay(1500);

    // If handshake is completed, consider the peer valid and add to JSON file.
    // Else do nothing. At the end, remove file from testing.
    if (customSocket.handShakeCompleted) {
      addPeer(String(customSocket.remoteAddress));
      console.log(`Peer Validity Test Passed: ${customSocket.remoteAddress}`)
    } else {
      console.log(`Peer Validity Test Failed: ${customSocket.remoteAddress}`)
    }
    removeFromTesting(String(customSocket.remoteAddress));
    console.log(`Testing peer address removed: ${customSocket.remoteAddress}`)

    socket.end();
  })

  socket.on('error', (e: any) => {
    console.error(e);
    removeFromTesting(`${e.address}:${e.port}`);
    console.log(`${e.address}:${e.port}`)

  })


}



