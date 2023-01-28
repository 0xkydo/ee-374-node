// Include Nodejs' net module.
import Net from 'net';
import { canonicalize } from "json-canonicalize";

import { blake2s } from '../classes/utils/crypto';
import errors from '../FIXED_MESSAGES/errors.json';
import hello from "./hello_test.json";
import {transaction} from '../classes/utils/formatChecker'
import delay from "delay";
import msg from './test.json'

const nodeAddy = '54.67.110.108';
const monitorAddy = '52.53.175.221';
const local = '0.0.0.0'
const test = '45.63.89.228';

// The port number and hostname of the server.
const port = 18018;
const host = local;

// Create a new TCP client.
const client = new Net.Socket();

const block = {
  "T": "00000000abc00000000000000000000000000000000000000000000000000000",
  "created": 1671148800,
  "miner": "Marabu Bounty Hunter",
  "nonce": "15551b5116783ace79cf19d95cca707a94f48e4cc69f3db32f41081dab3e6641",
  "note": "First block on genesis, 50 bu reward",
  "previd": "0000000052a0e645eca917ae1c196e0d0a4fb756747f29ef52594d68484bb5e2",
  "txids": ["8265faf623dfbcb17528fcd2e67fdf78de791ed4c7c60480e8cd21c6cdc8bcd4"],
  "type": "block"
}

console.log(canonicalize(block));

// Send a connection request to the server.
client.connect({ port: port, host: host }, async function () {
  // If there is no error, the server has accepted the request and created a new 
  // socket dedicated to us.

  client.write(canonicalize(hello)+'\n');

  // client.write(canonicalize(msg.object1)+'\n');

  // await delay(5000);

  // client.write(canonicalize(msg.object2)+'\n');

  // await delay(5000);

  client.write(canonicalize(msg.object8)+'\n');


});


// The client can also receive data from the server by reading from its socket.
client.on('data', function (chunk) {
  let rawString: string = chunk.toString();
  console.log(`Data received from the server: ${rawString}`);


  // client.write(canonicalize(peers) + '\n')
  // console.log(`sent over peers`)

  // Request an end to the connection after the data has been received.
});

client.on('error', (e: any) => {
  console.error(e);
  console.log(`${e.address}:${e.port}`);
})

client.on('end', function () {
  console.log('Requested an end to the TCP connection');
});
