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
import { DESTRUCTION } from 'dns';



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
  startTimer = Date.now();


  constructor(socket: net.Socket) {
    // Store socket
    this._socket = socket;
    // Set socket timeout time to 10 seconds
    this._socket.setTimeout(10000);
    // Store remoteAddress in peer format.
    this.remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;

    console.log(`Socket connection established with ${this.remoteAddress}, ${socket.readyState}`);

    // Start handshake process.
    this.write(hello);
  }

  // @param data: JSON object.
  // @about: tries to canonicalize the JSON object, if it fails,
  // it will write an internal error message.
  write(data: object): boolean {

    try {
      let jsonCanon: string = canonicalize(data);
      console.log(`Message sent to ${this.remoteAddress} | Message: ${jsonCanon}`)
      return this._socket.write(jsonCanon + '\n');
    } catch (error) {
      console.log(`ERROR: Message cannot be canonicalized and sent over | Remote address: ${this.remoteAddress}`);
      console.error(error);
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
        this._socket.on('timeout',()=>{ this._timeoutHandler()});
      default:
        this._socket.on(event, listener);
        break;
    }
  }

  // After 10 seconds of idle, if there's still things in the buffer, terminate connection.
  private  _timeoutHandler() {

    if(this.buffer.length>0){
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

    this.buffer += data;

    this.messages = this.buffer.split("\n");
    if (this.messages.length > 0) {
      for (var message of this.messages.slice(0, -1)) {
        this._messageToJSON(message);
      }
      this.buffer = this.messages[this.messages.length - 1];
    }
   

  };

  // _formatChecker checks if the message it received is the correct
  // JSON format, if it is not, it will either end the connection if
  // handshake is not completed or send an invalid format message. If
  // it can be parsed to JSON in correct format, the object is passed 
  // to the _objRouter for next steps.
  private _messageToJSON(message: string) {
    console.log(`Message received: ` + message);
    try {
      // Parse string into JSON object.
      this.obj = JSON.parse(message);

      var isCorrectFormat = formatChecker(this.obj)[0];
      var errorMessage = formatChecker(this.obj)[1];
      
      // Check if the format is correct
      if (isCorrectFormat) {
        this._objRouter(this.obj);
      }else if(this.handShakeCompleted){
        this._nonFatalError(errorMessage);
      }else{
        this._fatalError(errors.INVALID_HANDSHAKE);
      }
    } catch (e) {
      console.log(e);
      if (this.handShakeCompleted) {
        this._nonFatalError(errors.INVALID_FORMAT);
      } else {
        this._fatalError(errors.INVALID_FORMAT);
      }
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
      if (obj.type === "hello") {
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
    if (obj.version.slice(0, -1) === "0.9.") {
      this.Name = obj.agent;
      this.ID = 0 // TODO for random ID.
      this.handShakeCompleted = true;
      console.log("Handshake Completed Successfully.")
      this.write(getpeers);
    } else {
      this._fatalError(errors.INVALID_FORMAT);
    }

  }

  // Handles all non-fatal error messaging. However, if total error surpasses 50, the node will be force disconnected.
  private _nonFatalError(error: ErrorJSON) {
    this.write(error);
    console.log(error.message)
    this.errorCounter++;
    if(this.errorCounter>this.MAX_ERROR_COUNTS){
      console.log(`Too many errors. Socket connection destroyed.`)
      this._socket.destroy();
    }
  }

  
  // Handles all fatal error messaging. Also instantly terminate connection.
  private _fatalError(error: ErrorJSON) {
    this.write(error);
    console.log(error.message)
    this._socket.destroy();
  }

  // End the socket connection.
  end() {
    console.log("Ending socket connection...")
    this._socket.end();
  }


}
