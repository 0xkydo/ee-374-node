// Import Libraries
import path from 'path';
import fs from 'fs';
import level from 'level-ts'

import { MarabuNode } from '../classes/MarabuNode';

import peers from '../peers/peers.json'
import { DATABASE_PATH } from '../constants';
import genesis from '../FIXED_MESSAGES/genesis.json'

// The port on which the server is listening.
const PORT = 18018;

// Clear Testing Peers List
var testingPath = path.resolve(__dirname, '../peers/testing.json');
fs.writeFileSync(testingPath, `{"peers":[]}`);

// Store genesis block
var databasePath = path.resolve(__dirname, '../database');

var _db = new level(databasePath);
_db.put('0000000052a0e645eca917ae1c196e0d0a4fb756747f29ef52594d68484bb5e2',genesis);

// Spin up node instance
let node = new MarabuNode(PORT);

// Connect to existing nodes
try{
  for(var peer of peers.peers){
    const address = peer.split(":");
    const IP = address[0];
    const PORT = Number(address[1]);
  
    node.connectToNode(IP,PORT);
  }
}catch(e){
  console.error(e);
}


