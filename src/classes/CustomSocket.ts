import { canonicalize } from 'json-canonicalize';
import * as net from 'net';
import level from 'level-ts';
import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';

// Internal
import { setPeersHandler } from './utils/setPeersHandler'
import formatChecker, { transactionCoinbase, transactionNonCoinbase, transaction } from './utils/formatChecker';
import { blake2s, batchSigVerifier } from './utils/crypto';
import { returnUTXO, addUTXOSet } from './utils/UTXOHandler';

// JSON Objects
import { ErrorJSON, HelloJSON } from './interface/JsonInterface';
import hello from "../FIXED_MESSAGES/hello.json";
import errors from '../FIXED_MESSAGES/errors.json';
import getpeers from '../FIXED_MESSAGES/getpeers.json'
import { DATABASE_PATH } from '../constants'


// Global Variables
const peersPath = path.resolve(__dirname, '../peers/peers.json');

export class CustomSocket {

  // Socket
  private _socket: net.Socket;

  // Database
  private _db = new level(DATABASE_PATH);

  // Event Emitter
  private _emitter = new EventEmitter();

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

    // Set socket.on functions
    this._socket.on('data', (data) => { this._dataHandler(data) });
    this._socket.on('timeout', () => { this._timeoutHandler() });


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
  on(event: 'ihaveobject', listener: (data: string) => void): void;
  on(event: 'getobject', listener: (data: string) => void): void;
  on(event: string, listener: (...args: any[]) => void) {
    switch (event) {
      case 'data':
        this._socket.on('data', (data) => { listener(data) })
        break;
      case 'timeout':
        this._socket.on('timeout', () => { listener() });
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

      var [isCorrectFormat, errorMessage] = formatChecker(this.obj);

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
          this._sendObjectHandler(obj);
          break;
        case "ihaveobject":
          this._requestObjectHandler(obj);
          break;
        case "object":
          this._objectHandler(obj);
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

    let peers = JSON.parse(fs.readFileSync(peersPath, 'utf8'));
    this.write(peers);
  }

  // Send Object
  private _sendObjectHandler(obj: any) {
    // Check if requested object exists in file.
    this._db.exists(obj.objectid).then((exists) => {

      if (exists) {

        this._db.get(obj.objectid).then((temp) => {

          // Construct the Object JSON file.
          let tempObject = { "type": "object", "object": null };
          tempObject.type = 'object';
          tempObject.object = temp;

          // Send over the object.
          this.write(tempObject);
        })

      } else {
        // Requested file does not exist, write back error message.
        this.write(errors.UNKNOWN_OBJECT);
      }
    })
  }

  // Request Object
  private _requestObjectHandler(obj: any) {

    // Check if this object already exist in file.
    this._db.exists(obj.objectid).then((exists) => {
      if (exists) {
        // If the object already exists in file, no nothing
        console.log(`STAT | ${obj.objectid} | Object exists in file`)
      } else {
        // If the file does not exist, request object.
        this.write({ "type": "getobject", "objectid": obj.objectid });
      }
    })

  }

  // Handle Incoming Object
  private async _objectHandler(obj: any) {

    // Find object ID:
    var tempObj = obj.object;
    var objectID = blake2s(canonicalize(tempObj));

    // Check if object is already in database.
    let isThere = await this._db.exists(objectID);
    if (isThere) {
      // File exists and do nothing.
      console.log(`STAT | ${this.remoteAddress} | Object already exists ${objectID}`);
      return;
    }

    // Check object validity
    let isValid = await this._isValidObject(obj.object)
    // If object is valid.
    if (isValid) {

      // Get objectId in blake2s and check if object exists
      let objectID = blake2s(canonicalize(obj.object));
      await this._db.put(objectID, obj.object);

      // Let the node know I have a file and broadcast to all current connections.
      this._socket.emit('ihaveobject', objectID);
      console.log(`STAT | ${this.remoteAddress} | Received and stored valid object ${objectID}`);

    }
  }

  // Object Validation Logic
  private async _isValidObject(obj: any): Promise<boolean> {

    // Separate logic for transaction and block.
    if (obj.type == 'transaction') {
      return await this._transactionValidation(obj)

    } else {
      return await this._blockValidation(obj);
    }

  }

  private async _blockValidation(block: any): Promise<boolean> {

    // Check proof-of-work correctness
    const blockid = blake2s(canonicalize(block));
    const blockDiff = parseInt(blockid,16);
    const tDiff = parseInt(block.T,16);

    // PoW doesn't hold
    if(!(blockDiff<tDiff)){
      this._fatalError(errors.INVALID_BLOCK_POW);
      return false;
    }

    // Check transactions in the block is valid
    const transactionStatus = await this._blockTxValidation(block);

    return true;
  }

  private async _blockTxValidation(block: any): Promise<boolean> {

    const txids = block.txids;
    const previd = block.previd;
    var coinbaseTx = "";
    var currentInputs: string[] = [];
    var totalInputAmount = 0;
    var totalOutputAmount = 0;

    // Get the UTXO set for the previd block
    var UTXOOrigin = returnUTXO(previd);
    // If the prev block id is not there, ask for it.
    if (UTXOOrigin === undefined) {
      // Wait for the object to be received.
      let isReceived = await this._waitForObject(previd)
      // If it is not there, terminate
      if (!isReceived) {
        this._fatalError(errors.UNFINDABLE_OBJECT);
        return false;
      } else {
        UTXOOrigin = returnUTXO(previd);
      }
    }

    // Copy UTXO set to local.
    var UTXOSet = [...UTXOOrigin];

    // Check each tx within the block.
    for (var i = 0; i < txids.length; i++) {
      var txid = txids[i];
      // Check if all transaction exists
      let isThere = await this._db.exists(txid);
      // If the tx is not in database.
      if (!isThere) {

        // Wait two seconds and see if the object is received.
        const isReceived = await this._waitForObject(txid);

        // If the object is not received, terminate connection.
        if (!isReceived) {
          this._fatalError(errors.UNFINDABLE_OBJECT);
          return false;
        }

      }

      // Retrieve the object and check if it is a valid transaction.
      const tx = await this._db.get(txid);

      // Check if it is a transaction and not a block.
      // TODO send back the failed transaction?
      const status = transaction.safeParse(tx);
      if (!status.success) {
        this._fatalError(errors.INVALID_FORMAT)
        return false;
      }


      // If it is the first index of the tx, it needs to be a coinbase transaction.
      if (i == 0) {
        // Stores coinbase transaction hash to prevent spending in current block.
        coinbaseTx = txid;

        // Check if the transaction is a coinbase transaction
        let status = transactionCoinbase.safeParse(tx);
        // If it is invalid, end connection and send error message.
        if (!status.success) {
          this._fatalError(errors.INVALID_BLOCK_COINBASE);
          return false;
        }

        // Store coinbase transaction into UTXO
        // Add 0 because the index of the UTXO is at 0.
        UTXOSet.push(coinbaseTx + '0');

        totalOutputAmount += tx.outputs[0].value;

      } else {
        // Parse if the transaction is not a coinbase transaction
        let status = transactionNonCoinbase.safeParse(tx);

        // If it is a coinbase transaction, terminate.
        if (!status.success) {
          this._fatalError(errors.INVALID_BLOCK_COINBASE);
          return false;
        }

        // Loop through transaction inputs
        for (var input of tx.inputs) {
          // Get the input transaction
          // Check if the outpoint is the current coinbase
          let txid = input.outpoint.txid
          let index = input.outpoint.index
          let utxo = txid + index;
          // If it is the coinbase transaction, terminate.
          if (txid == coinbaseTx) {
            this._fatalError(errors.INVALID_BLOCK_COINBASE)
            return false;
          }

          // Check if the tx is in UTXO set.
          // If the tx input is not in the UTXO set given previd, or
          // it is in another transaction input in the same block,
          // terminate connection, return false.
          if (!(utxo in UTXOSet) || utxo in currentInputs) {
            this._fatalError(errors.INVALID_TX_OUTPOINT)
            return false;
          }

          // Stores current UTXO in currentInput set.
          currentInputs.push(utxo);

          // Remove the tx from UTXO set.
          UTXOSet = UTXOSet.filter((_utxo) => _utxo != utxo);

          // Locate the value of the output from the input transaction
          let inputTx = await this._db.get(txid)
          let inputAmt = inputTx.outputs[index].value

          // Add input value to total input value for checking entire block
          // law of conservation.
          totalInputAmount += inputAmt;

        }

        // Loop through transaction outputs, sum all outputs
        // and add new UTXOs in UTXOSet

        for (var i = 0; i < tx.outputs.length; i++) {
          // Add value of the output.
          totalOutputAmount += tx.outputs[i].value;

          // Add new UTXO into the UTXO set.
          let utxo = txid + i;
          UTXOSet.push(utxo);
        }

      }

    }

    // Check if law of conservation is held in block.
    
    // Add block issuerance in the total input amount.
    totalInputAmount += 50*(Math.pow(10,12));

    // If law of conservation is broken, terminate.
    if(totalInputAmount < totalOutputAmount){

      this._fatalError(errors.INVALID_BLOCK_COINBASE)
      return false;

    }

    // Update UTXO set for the current blockid
    const blockid = blake2s(canonicalize(block));
    addUTXOSet(blockid,UTXOSet);

    return true;
  }

  // Wait for a given object to be received. If it is not received after
  // 2 seconds of calling this function, it will return false.
  private async _waitForObject(txid: string): Promise<boolean> {

    // Ask for it on the Node level.
    this._socket.emit('getobject', txid);

    return new Promise( (resolve) => {
      // Create a two second timeout. If no object was received, return false.
      const timeout = setTimeout(async () => {
        if(await this._db.exists(txid)){
          resolve(true);

        }else{
          resolve(false);
        }
      }, 2000)
      // When the socket receives a valid object with the corresponding ID,
      // Return true
      this._socket.on('ihaveobject', (id) => {
        if (id == txid) {
          clearTimeout(timeout);
          resolve(true);
        }
      })

    })
  }

  private async _transactionValidation(obj: any): Promise<boolean> {

    // Coinbase transaction
    if (obj.height != null) return true;

    // Initiate variables for signature checking.
    let unSignedTX = JSON.parse(JSON.stringify(obj));
    var pubkeyArray: string[] = [];
    var sigArray: string[] = [];

    // Initiate variables for checking law of conservation.
    var totalInputAmount = 0;
    var totalOutputAmount = 0;
    var outputLen = obj.outputs.length;

    for (let i = 0; i < obj.inputs.length; i++) {
      // Ensure that a valid transaction with the given txid exists in your object database
      let txid = obj.inputs[i].outpoint.txid;
      let index = obj.inputs[i].outpoint.index;
      let signature = obj.inputs[i].sig;

      if (await this._db.exists(txid)) {
        var inputTX = await this._db.get(txid);
      } else {
        this._fatalError(errors.UNKNOWN_OBJECT);
        return false;
      }

      // Ensure that given index is less than the number of outputs in the outpoint transaction
      if (index >= inputTX.outputs.length) {
        this._fatalError(errors.INVALID_TX_OUTPOINT);
        return false;
      };

      // Remove current signature in unsigned tx
      unSignedTX.inputs[i].sig = null;
      // Store the pk for the input tx in pubkey array
      pubkeyArray.push(inputTX.outputs[index].pubkey);

      // Store the signature for the entire message in signature array
      sigArray.push(signature);

      // Add input value from the current outpoint to totalInputAmount
      totalInputAmount += inputTX.outputs[index].value;

    }

    // Calculate totalOutputAmount by iterating all value's in obj.outputs
    for (let i = 0; i < outputLen; i++) {
      totalOutputAmount += obj.outputs[i].value;
    }

    // Check for law of conservation
    if (totalInputAmount < totalOutputAmount) {
      this._fatalError(errors.INVALID_TX_CONSERVATION);
      return false;
    };

    // Check signature validity
    let message = Buffer.from(canonicalize(unSignedTX), 'utf-8')
    if (batchSigVerifier(message, pubkeyArray, sigArray)) {
      return true;
    } else {
      this._fatalError(errors.INVALID_TX_SIGNATURE);
      return false;
    }

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

  /*************************
  Error Functions
  **************************/

  // Handles all non-fatal error messaging. However, if total error surpasses 50, the node will be force disconnected.
  private _nonFatalError(error: ErrorJSON) {
    this.write(error);
    console.log(`NERR | ${this.remoteAddress} | ${error.name}`)
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
