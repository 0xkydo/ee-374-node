import fs from 'fs';
import Net from 'net';
import { CustomSocket } from '../CustomSocket';
import delay from 'delay';

var socketValidity: boolean = false;

export function setPeerHandler(obj: any) {

  // Read current peer and testing peer list.
  let testing = JSON.parse(fs.readFileSync('/Users/k/Desktop/repos/ee-374-node/src/peers/testing.json', 'utf8'));
  let peers = JSON.parse(fs.readFileSync('/Users/k/Desktop/repos/ee-374-node/src/peers/peers.json', 'utf8'));

  // Extract JSON objects's peer list into arrays.
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
    fs.writeFileSync('/Users/k/Desktop/repos/ee-374-node/src/peers/testing.json', JSON.stringify(newTestingJSON));

    // Check peer validity.
    peerValidityTest(newPeer).then((isValid) => {

      console.log(`Peer Validity Test Completed for ${newPeer}, it is ${isValid}`);

      // Re-read the peers.json and testing file to track any changes during looped validity tests.
      let testing = JSON.parse(fs.readFileSync('/Users/k/Desktop/repos/ee-374-node/src/peers/testing.json', 'utf8'));
      let peers = JSON.parse(fs.readFileSync('/Users/k/Desktop/repos/ee-374-node/src/peers/peers.json', 'utf8'));

      // Extract JSON objects's peer list into arrays.
      let oldPeers: string[] = peers.peers;
      let testingPeers: string[] = testing.peers;

      // If the new peer is a valid new peer, add to oldpeer list.
      if (isValid) {
        oldPeers.push(newPeer);
      }

      // Remove the current peer from the testing list.
      testingPeers = testingPeers.filter((peer) => { peer !== newPeer });

      // Update the testing peer file.
      let newTestingJSON = testing;
      newTestingJSON.peers = testingPeers;
      fs.writeFileSync('/Users/k/Desktop/repos/ee-374-node/src/peers/testing.json', JSON.stringify(newTestingJSON));

      // Update the peers json file.
      let newPeerJSON = peers;
      newPeerJSON.peers = oldPeers;
      fs.writeFileSync('/Users/k/Desktop/repos/ee-374-node/src/peers/peers.json', JSON.stringify(newPeerJSON));
    })

  }

}

async function peerValidityTest(peer: string): Promise<boolean> {

  const node: string[] = peer.split(":");

  const PORT = Number(node[1]);
  const NODE = node[0];

  let socket = new Net.Socket();

  socket.on('connect', async () => {

    let customSocket = new CustomSocket(socket);

    customSocket.on('data', (data) => { });

    await delay(1500);

    console.log(`${customSocket.remoteAddress} Validity Status: ${customSocket.handShakeCompleted}`)

    socketValidity = customSocket.handShakeCompleted;
  })

  socket.connect({
    port: PORT,
    host: NODE
  });

  await delay(2000);

  return socketValidity;

}