// Include Nodejs' net module.
import { setTimeout } from "timers/promises";
import Net from 'net';
import { canonicalize } from "json-canonicalize";

import errors from '../FIXED_MESSAGES/errors.json';
import hello from "../FIXED_MESSAGES/hello_test.json";
import peers from '../peers/peers_test.json';


// The port number and hostname of the server.
const port = 18018;
const host = '54.67.110.108';

// Create a new TCP client.
const client = new Net.Socket();
const startTime = Date.now();

// Send a connection request to the server.
client.connect({ port: port, host: host }, async function () {
  // If there is no error, the server has accepted the request and created a new 
  // socket dedicated to us.
  console.log('TCP connection established with the server.');
  const endTime = Date.now();
  // Calculate the latency
  const latency = endTime - startTime;
  console.log(`Latency: ${latency}ms`);

  // The client can now send data to the server by writing to its socket.
  client.write(canonicalize(hello) + '\n');
  console.log(`message sent.`)
  setTimeout(5000);
  client.write(canonicalize({ "type": "getpeers" }) + '\n');


});

// The client can also receive data from the server by reading from its socket.
client.on('data', function (chunk) {
  let rawString: string = chunk.toString();
  console.log(`Data received from the server: ${rawString}`);


  client.write(canonicalize(peers) + '\n')
  console.log(`sent over peers`)

  // Request an end to the connection after the data has been received.
});

client.on('error', (e: any) => {
  console.error(e);
  console.log(`${e.address}:${e.port}`);
})

client.on('end', function () {
  console.log('Requested an end to the TCP connection');
});
