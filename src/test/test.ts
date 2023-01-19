// Include Nodejs' net module.
import Net from 'net';
import { canonicalize } from "json-canonicalize";

import errors from '../FIXED_MESSAGES/errors.json';
import hello from "../FIXED_MESSAGES/hello_test.json";
import peers from '../peers/peers_test.json';
import delay from "delay";

const nodeAddy = '54.67.110.108';
const monitorAddy = '52.53.175.221';
const local = '0.0.0.0'
const test = '45.63.89.228';
const ryanAddy = '135.181.112.99';

// The port number and hostname of the server.
const port = 18018;
const host = ryanAddy;

// Create a new TCP client.
const client = new Net.Socket();
const startTime = Date.now();

// Send a connection request to the server.
client.connect({ port: port, host: host }, async function () {
  // If there is no error, the server has accepted the request and created a new 
  // socket dedicated to us.
  console.log('TCP connection established with the server.');

  // client.write(`{ "type": "dsdafsdfsf" }\n`)
  client.write(canonicalize(hello)+`\n`)
  client.write(`{ "type": "getpeers"}\n`);
  // console.log(`{ "type": "getpeers"`);
  // client.write(`}\n`)


  // await delay(1000);


  // client.write(`}\n`)
  // console.log(`}\n`);


  // await delay(1000);

  // client.write(canonicalize(peers) + `\n` );


  // client.write(canonicalize(peers)+`\n`);



  // The client can now send data to the server by writing to its socket.
  console.log(`message sent.`)
  // client.write('\n');
  // client.write(canonicalize({ "type": "getpeers" }) + '\n');


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
