import { canonicalize } from 'json-canonicalize';
import { setPeersHandler } from './utils/setPeersHandler'
import formatChecker from './utils/formatChecker';
import * as net from 'net';
import level from 'level-ts';
import blake2s from './utils/crypto';
import * as ed from '@noble/ed25519';

// Import interfaces for JSON objects
import { ErrorJSON, HelloJSON } from './interface/JsonInterface';
import hello from "../FIXED_MESSAGES/hello.json";
import errors from '../FIXED_MESSAGES/errors.json';
import peers from '../peers/peers.json';
import getpeers from '../FIXED_MESSAGES/getpeers.json'

import { DATABASE_PATH}  from '../constants'

export class CustomSocket {

  // Socket
  private _socket: net.Socket;

  // Database
  private _db = new level(DATABASE_PATH);

  // Constants
  MAX_BUFFER_SIZE: number = 1 * 1000000;
  MAX_ERROR_COUNTS: number = 50

  // Node variables
  Name: string = '';
  ID: number = 0;
  remoteAddress: string | undefined = "";

  // Status Variables
  handShakeCompleted: boolean = false;
  errorCounter: number = 0;

  // Message Variables
  buffer: string = "";
  messages: string[] = [];
  obj: any = null;
  bufferTimer: any;
  isBufferTimerStarted: boolean = false;


  constructor(socket: net.Socket) {
    // Store socket
    this._socket = socket;
    // Set socket timeout time to 10 seconds
    this._socket.setTimeout(10000);
    // Store remoteAddress in peer format.
    this.remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;

    console.log(`CONN | ${this.remoteAddress} | CustomSocket class wrapped`);

    // Start handshake process.
    this.write(hello);
    // Immediately send getpeers request.
    this.write(getpeers);
  }

  // @param data: JSON object.
  // @about: tries to canonicalize the JSON object, if it fails,
  // it will write an internal error message.
  write(data: object): boolean {

    // If socket is destroyed, do not write and return false.
    if (this._socket.destroyed) {
      return false;
    }

    try {
      // Canonicalize data object
      let jsonCanon: string = canonicalize(data);
      console.log(`SENT | ${this.remoteAddress} | ${jsonCanon} `)
      return this._socket.write(jsonCanon + '\n');
    } catch (error) {
      console.error(error);
      console.log(`NERR | ${this.remoteAddress} | ${canonicalize(errors.INTERNAL_ERROR)}`);
      return this._socket.write(canonicalize(errors.INTERNAL_ERROR) + '\n');
    }
  }

  // on modifies the old socket.on function.
  on(event: string, listener: (...args: any[]) => void): void;
  on(event: 'close', listener: (hadError: boolean) => void): void;
  on(event: 'connect', listener: () => void): void;
  on(event: 'data', listener: (data: Buffer) => void): void;
  on(event: 'drain', listener: () => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: 'lookup', listener: (err: Error, address: string, family: string | number, host: string) => void): void;
  on(event: 'ready', listener: () => void): void;
  on(event: 'timeout', listener: () => void): void;
  on(event: string, listener: (...args: any[]) => void) {
    switch (event) {
      case 'data':
        this._socket.on('data', (data) => { this._dataHandler(data) })
        break;
      case 'timeout':
        this._socket.on('timeout', () => { this._timeoutHandler() });
      default:
        this._socket.on(event, listener);
        break;
    }
  }

  // After 10 seconds of idle, if there's still things in the buffer, terminate connection.
  private _timeoutHandler() {

    if (this.buffer.length > 0) {
      this._fatalError(errors.INVALID_FORMAT);
    }

  }

  // _dataHandler Handles the first step converting buffer to string
  // data. It then passes the string data to _formatChecker and
  // _formatChecker passes it down.
  private _dataHandler(data: any) {

    // If the buffer data gets too long before being formed into a message,
    // connection will be terminated and buffer will be cleared.
    if (this.buffer.length + data.length > this.MAX_BUFFER_SIZE) {
      this.buffer = "";
      this._fatalError(errors.INVALID_FORMAT);
    }

    // If there's no buffer and the bufferTimer is not started,
    // start the timer.
    if (this.buffer.length == 0 && !this.isBufferTimerStarted) {
      this.bufferTimer = setTimeout(() => {
        console.log(`FERR | ${this.remoteAddress} | Buffer not completed in time.`);
        this._fatalError(errors.INVALID_FORMAT);
      }, 10000);
    }

    // Add new data into buffer
    this.buffer += data;
    // Split messages into elements based on newline char.
    this.messages = this.buffer.split("\n");
    // Loop through messages and process each one.
    if (this.messages.length > 1) {
      // Cancel buffer timeout.
      clearTimeout(this.bufferTimer);

      // Check all message instead of the last one.
      for (var message of this.messages.slice(0, -1)) {
        // Pass message to processing
        this._messageToJSON(message);
      }
      // Set current buffer into the last messages element.
      this.buffer = this.messages[this.messages.length - 1];
    }


  };

  // _formatChecker checks if the message it received is the correct
  // JSON format, if it is not, it will either end the connection if
  // handshake is not completed or send an invalid format message. If
  // it can be parsed to JSON in correct format, the object is passed
  // to the _objRouter for next steps.
  private _messageToJSON(message: string) {
    console.log(`RECE | ${this.remoteAddress} | ${message}`);
    try {
      // Parse string into JSON object.
      this.obj = JSON.parse(message);

      var isCorrectFormat = formatChecker(this.obj)[0];
      var errorMessage = formatChecker(this.obj)[1];

      // Check if the format is correct
      if (isCorrectFormat) {
        this._objRouter(this.obj);
      } else {
        this._fatalError(errorMessage);
      }
    } catch (e) {
      this._fatalError(errors.INVALID_FORMAT);
    }
  }

  // _objRouter routes the JSON object to the correct handler based
  // on the type information within the JSON object. Before the
  // handshake is completed, non-hello messages will be dropped
  // by the router.
  private _objRouter(obj: any) {

    if (this.handShakeCompleted) {
      switch (obj.type) {
        case "getpeers":
          this._getpeersHandler(obj);
          break;
        case "peers":
          setPeersHandler(obj);
          break;
        case "getobject":
          this._sendObject(obj);
          break;
        case "ihaveobject":
          this._requestObject(obj);
          break;
        case "object":
          this._addObject(obj);
          break;
        default:
          break;
      }
    } else {
      if (obj.type === 'hello') {
        this._handshakeHandler(obj);
      } else {
        this._fatalError(errors.INVALID_HANDSHAKE);
      }
    }

  }

  // When asked to get peer, it will return the peers.json file.
  private _getpeersHandler(obj: any) {
    this.write(peers);
  }

  // Send Object
  private _sendObject(obj: any) {
    this._db.get(obj.data, (error) => {
      if (error) return;
      this.write({ "type": "object", "data": data });
    });
  }

  // Request Object
  private _requestObject(obj: any) {
    db.get(obj.data, (error, data) => {
      if (error) this.write({ "type": "getobject", "data": obj.data });
    });
  }

  // Add Object
  private _addObject(obj: any) {
    if (!this._isValidObject(obj.data)) return
    let objectID = blake2s(canonicalize(obj.data));
    this._db.put(objectID, obj.data, (error, data) => {
      if (error) return;
      let peers: string[] = peers.peers;
      for (var newPeer of newPeers) {
        const server: string[] = peer.split(":");

        const PORT = Number(server[1]);
        const SERVER = server[0];

        const socket = new CustomSocket(net.createConnection({
          port: PORT,
          host: SERVER
        }));

        socket.write({ "type": "ihaveobject", "data": objectID });
      }
    });
  }

  // Transaction Validation Logic
  private _isValidObject(obj: any): boolean {

    if(!_isValidFormatTX(obj)){
      this._fatalError(errors.INVALID_FORMAT);
      return false;
    }

    // Coinbase transaction
    if (obj.height != null) return true;

    let outputLen = obj.outputs.length;

    for (let i = 0; i < obj.inputs.length; i++){
      // Ensure that a valid transaction with the given txid exists in your object database
      this._db.get(obj.inputs[i].outpoint.txid, (error, data) => {
        if (error) return false;
      });

      // Ensure that given index is less than the number of outputs in the outpoint transaction
      if (obj.inputs[i].outpoint.index >= outputLen) return false;

      // Ensure valid input signature
      let plaintextToSign = obj.inputs[i];
      plaintextToSign.sig = null;
      let message = Uint8Array.from(canonicalize(plaintextToSign));
      ed.verify(obj.inputs[i].sig, message, obj.outputs[i].pubkey).then((value) => {
        if (!value) return false;
      });

      // Ensure pubkey and value keys exist
      if (obj.outputs[i].pubkey == null || obj.outputs[i].value) return false;

      // Ensure valid output public key
      var alphanum = /^[a-z0-9]+$/i
      if (!alphanum.test(obj.outputs[i].pubkey) || obj.outputs[i].pubkey.length != 64) return false;

      // Ensure valid output value
      if (obj.outputs[i].value < 0) return false;
    }

    let totalInputAmount = 0;
    let totalOutputAmount = 0;

    /*
    Transactions must respect the law of conservation, i.e. the sum of all input values
    is at least the sum of output values.
    */

    for (let i = 0; i < outputLen; i++){
      totalInputAmount +=
      db.get(obj.inputs[i].outpoint.txid, (error, data) => {
            // iterate through all outputs of data tx and sum up and add to total input amount
      });

      totalOutputAmount += obj.outputs[i].value
    }

    if(totalInputAmount < totalOutputAmount) return false;

    return true;
  }

  private _isValidFormatTX(obj: any): boolean {
      if(obj.inputs == null || obj.outputs == null) return false;

      for (let i = 0; i < obj.inputs.length; i++){
        if(obj.inputs[i].outpoint == null || obj.inputs[i].sig == null) return false;
        if(obj.inputs[i].sig.length != 128) return false;
        if(obj.inputs[i].outpoint.txid == null || obj.inputs[i].outpoint.index == null) return false;
        // Ensure valid index value
        if(obj.inputs[i].outpoint.index < 0) return false;

        // Ensure pubkey and value keys exist
        if(obj.outputs[i].pubkey == null || obj.outputs[i].value) return false;

        // Ensure valid output public key
        var alphanum = /^[a-z0-9]+$/i
        if(!alphanum.test(obj.outputs[i].pubkey) || obj.outputs[i].pubkey.length != 64) return false;

        // Ensure valid output value
        if(obj.outputs[i].value < 0) return false;
      }

      return true;
  }

  // _handshakeHandler handles the handshake phase of the protocol.
  // It takes a HelloJSON object and checks if the version starts with
  // "0.9.". It then stores the agent name into the socket info.
  // If the version is wrong, it will terminate connection and send
  // error message.
  private _handshakeHandler(obj: HelloJSON) {
    this.Name = obj.agent;
    this.ID = 0 // TODO for random ID.
    this.handShakeCompleted = true;
    console.log(`STAT | ${this.remoteAddress} | Handshake completed.`);
  }

  // Handles all non-fatal error messaging. However, if total error surpasses 50, the node will be force disconnected.
  private _nonFatalError(error: ErrorJSON) {
    this.write(error);
    console.log(`NERR | ${this.remoteAddress} | ${error.type}`)
    console.log(error.message)
    this.errorCounter++;
    if (this.errorCounter > this.MAX_ERROR_COUNTS) {
      this._socket.destroy();
      console.log(`FERR | ${this.remoteAddress} | Too many non-fatal errors`)
      console.log(` END | ${this.remoteAddress} | Connected Ended`)
    }
  }


  // Handles all fatal error messaging. Also instantly terminate connection.
  private _fatalError(error: ErrorJSON) {
    this.write(error);
    console.log(`FERR | ${this.remoteAddress} | ${error.type}`)
    this._socket.destroy();
    console.log(` END | ${this.remoteAddress} | Connected Ended`)
  }

  // End the socket connection.
  end() {
    this._socket.end();
    console.log(` END | ${this.remoteAddress} | Connected Ended`)
  }


}
