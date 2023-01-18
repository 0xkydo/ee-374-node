import { canonicalize } from 'json-canonicalize';
import { setPeersHandler } from './utils/setPeersHandler'
import formatChecker from './utils/formatChecker';
import * as net from 'net';

// Import interfaces for JSON objects
import { ErrorJSON, HelloJSON } from './interface/JsonInterface';
import hello from "../FIXED_MESSAGES/hello.json";
import errors from '../FIXED_MESSAGES/errors.json';
import peers from '../peers/peers.json';
import getpeers from '../FIXED_MESSAGES/getpeers.json'



export class CustomSocket {

  // Socket
  private _socket: net.Socket;

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

    try {
      // Canonicalize data object
      let jsonCanon: string = canonicalize(data);
      // If socket is destroyed, do not write.
      if (this._socket.destroyed) {
        return false;
      } else {
        console.log(`SENT | ${this.remoteAddress} | ${jsonCanon} `)
        return this._socket.write(jsonCanon + '\n');
      }
    } catch (error) {
      console.error(error);
      if (this._socket.destroyed) {
        return false;
      } else {
        console.log(`NERR | ${this.remoteAddress} | ${canonicalize(errors.INTERNAL_ERROR)}`);
        return this._socket.write(canonicalize(errors.INTERNAL_ERROR) + '\n');
      }
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
