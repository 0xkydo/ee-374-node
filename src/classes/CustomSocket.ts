import { canonicalize } from 'json-canonicalize';
import { peerHandler } from './utils/PeerHandler'
import * as net from 'net';

// Import other files
import hello from "../FIXED_MESSAGES/hello.json";
import errors from '../FIXED_MESSAGES/errors.json';
import peers from '../peers/peers.json';
import getpeers from '../FIXED_MESSAGES/getpeers.json'

// Import interfaces for JSON objects
import { ErrorJSON, HelloJSON, PeerJSON } from './interface/JsonInterface';



export class CustomSocket {

  // Socket
  private _socket: net.Socket;

  // Node variables
  Name: string = '';
  ID: number = 0;
  remoteAddress: string | undefined = "";

  // Status Variables
  handShakeCompleted: boolean = false;

  // Message Variables
  buffer: string = "";
  messages: string[] = [];
  obj: any = null;


  constructor(socket: net.Socket) {
    this._socket = socket;
    this.remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`Socket connection established with ${this.remoteAddress}, ${socket.readyState}`);
    this.write(hello);
  }

  write(data: object): boolean {

    try {
      let jsonCanon: string = canonicalize(data);
      console.log(`Message sent: ${jsonCanon}`)
      return this._socket.write(jsonCanon+'\n');
    } catch (error) {
      return this._socket.write(canonicalize(errors.INTERNAL_ERROR)+'\n');
    }
  }

  // on modifies the old socket.on function.
  on(event: string, listener: (...args: any[]) => void) {
    switch (event) {
      case 'data':
        this._socket.on('data', (data) => { this._dataHandler(data) })
        break;
      default:
        this._socket.on(event, listener);
        break;
    }

  }

  // _dataHandler Handles the first step converting buffer to string
  // data. It then passes the string data to _formatChecker and
  // _formatChecker passes it down.
  private _dataHandler(data: any) {
    this.buffer += data;
    this.messages = this.buffer.split("\n");
    if (this.messages.length > 0) {
      for (var message of this.messages.slice(0, -1)) {
        this._formatChecker(message);
      }
      this.buffer = this.messages[this.messages.length - 1];
    }
  };

  // _formatChecker checks if the message it received is the correct
  // JSON format, if it is not, it will either end the connection if
  // handshake is not completed or send an invalid format message. If
  // it can be parsed to JSON, the object is passed to the _objRouter
  // for next steps.
  private _formatChecker(message: string) {
    console.log(`Message received: ` + message);
    try {
      this.obj = JSON.parse(message);
      this._objRouter(this.obj);
    } catch (e) {
      console.log(e);
      if (this.handShakeCompleted) {
        this.write(errors.INVALID_FORMAT);
      } else {
        this.write(errors.INVALID_FORMAT);
        this.end();
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
          peerHandler(obj);
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

  private _fatalError(error: ErrorJSON) {
    this.write(error);
    console.log(error.message)
    this.end();
  }

  end() {
    this._socket.end();
  }


}
