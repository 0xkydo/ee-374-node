import fs from 'fs';
import Net from 'net';
import path from "path";
import delay from 'delay';

import { CustomSocket } from '../CustomSocket';
import isValidDomain from 'is-valid-domain';
import { lookup } from 'dns';

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
      continue;
    }

    // If detect a new peer that's not in testing or stored in peers.json, first add the peer to testing file.
    console.log(`STAT | ${newPeer} | New peer detected.`)
    testingPeers.push(newPeer);
    let newTestingJSON = testing;
    newTestingJSON.peers = testingPeers;
    fs.writeFileSync(testingPath, JSON.stringify(newTestingJSON));

    peerValidityTest(newPeer);

  }

}

// Add peer to peers.json file.
function addPeer(newPeer: string) {

  // Re-read the peers.json and testing file to track any changes during looped validity tests.
  let peersJSON = JSON.parse(fs.readFileSync(peersPath, 'utf8'));

  // Extract JSON objects's peer list into arrays.
  let oldPeers: string[] = peersJSON.peers;

  // If the new peer is a valid new peer, add to oldpeer list.
  oldPeers.push(newPeer);

  // Update the peers json file.
  let newPeersJSON = peersJSON;
  newPeersJSON.peers = oldPeers;
  fs.writeFileSync(peersPath, JSON.stringify(newPeersJSON));

  console.log(`STAT | ${newPeer} | Added to peers.json`)

}

// TODO if the peer address is a DNS domain, it cannot be removed from testing.json currently.
function removeFromTesting(newPeer: string) {


  // Re-read the peers.json and testing file to track any changes during looped validity tests.
  let testingJSON = JSON.parse(fs.readFileSync(testingPath, 'utf8'));

  // Extract JSON objects's peer list into arrays.
  let testingPeers: string[] = testingJSON.peers;

  // Remove the current peer from the testing list.
  testingPeers = testingPeers.filter((peer) => {

    // Fist check if the peer is the newPeer we want to remove. If it is the same, return false.
    if (peer !== newPeer) {
      // Decompose the newPeer and peer into [IP,PORT] format.
      let newNode = newPeer.split(":");
      let node = peer.split(":");

      // Output DNS look up to IPv4 format.
      const options = {
        family: 4
      }

      // Chek if the peer stored in testing.json is a domain name.
      if (isValidDomain(node[0])) {
        // If it is a domain name, look up its IPv4 address
        lookup(node[0], options, (e, address, family) => {
          // Check IPv4 address, if it is the same as the one we are trying to remove,
          // return false. If it is not the same, return true and do not remove.
          // console.log(`${peer} IPv${family} address is: ${address}`)
          if (address == newNode[0]) {
            return false;
          } else {
            return true;
          }
        })
      } else {
        // Return true if it is not a domain name and the IP does not match.
        return true;
      }

    } else {
      // Return false if the peer string matches the newPeer we are trying to remove.
      return false;
    }

  });

  // Update the testing peer file.
  let newTestingJSON = testingJSON;
  newTestingJSON.peers = testingPeers;

  console.log(`STAT | ${newPeer} | Removed from testing.json`)

  fs.writeFileSync(testingPath, JSON.stringify(newTestingJSON));

}

function peerValidityTest(peer: string) {

  const node: string[] = peer.split(":");

  const PORT = Number(node[1]);
  const NODE = node[0];

  console.log(`STAT | ${peer} | Peer validity test started.`)

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
    }
    removeFromTesting(String(customSocket.remoteAddress));
    socket.end();
  })

  // If socket connection failed, console log error and remove address from testing.json
  socket.on('error', (e: any) => {
    console.error(e);
    removeFromTesting(`${e.address}:${e.port}`);
  })


}



