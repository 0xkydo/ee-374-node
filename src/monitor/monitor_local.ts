// Download the helper library from https://www.twilio.com/docs/node/install
// Set environment variables for your credentials
// Read more at http://twil.io/secure
import Net from 'net';

import { canonicalize } from "json-canonicalize";
import hello from "../FIXED_MESSAGES/hello_test.json";

const accountSid = "AC1b6e54d2f688b377568f344751ae23df";
const authToken = "359b5203d583c241b0fac691f6952bc5";
const cell = require("twilio")(accountSid, authToken);


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

  // cell.messages
  //   .create({ body: "Monitoring Started!", from: "+13854817615", to: "+19094132524" })
  //   .then((message: any) => console.log(message.sid));


  client.write(canonicalize(hello) + '\n');

});

client.on('data', function (chunk) {
  let rawString: string = chunk.toString();
  console.log(`Data received from the server: ${rawString}`);

});

client.on('end', function () {
  // cell.messages
  //   .create({ body: "NODE DISCONNECTED!", from: "+13854817615", to: "+19094132524" })
  //   .then((message: any) => console.log(message.sid));
  console.log('Requested an end to the TCP connection');
});
