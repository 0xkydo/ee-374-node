import level from 'level-ts';
import net from 'net';

// Import local files and lib
import { CustomSocket } from './CustomSocket';
import ihaveobject from '../FIXED_MESSAGES/ihaveobject.json';
import getobject from '../FIXED_MESSAGES/getobject.json';
import blocked from '../peers/blocked.json';

export class MarabuNode {

  private _server: net.Server;

  connections: CustomSocket[] = [];

  // Constructor initiate the node. It establishes the server, wrap and push 
  // the socket to the node class for record keeping.
  constructor(PORT: number) {

    this._server = net.createServer((_socket) => {

      _socket.on('connect', () => {
        // Check if it a blocked address.
        for (var blockedAddress of blocked.address) {
          if (_socket.remoteAddress == blockedAddress) {
            _socket.destroy();
          }
        }
      })
      
      let socket = new CustomSocket(_socket);
      this.connections.push(socket);

      console.log(`NODE | TOTAL CONNECTION | ${this.connections.length}`);
      socket.on('close', () => {
        console.log(`NODE | REMOVED SOCKET | ${socket.remoteAddress}`);
        this.connections = this.connections.filter((_socket) => _socket !== socket);
        console.log(`NODE | TOTAL CONNECTION | ${this.connections.length}`);
      });
      // When receiving a new object, broadcast to all current connections.
      socket.on('ihaveobject', async (objectID) => {
        await this.broadcast(objectID, ihaveobject);
      })
      // When need an object, ask the object from everyone.
      socket.on('getobject', async (objectID) => {
        await this.broadcast(objectID, getobject);
      })


    })

    this._server.listen(PORT, '0.0.0.0', () => {
      console.log(`NODE | START | Listening at port: ${PORT}`);
    });

  }

  // Method for connecting to another node.
  // TODO currently it does not check if the inputs are actually string and 
  // numbers. This can cause the node to go offline if adversary passes in 
  // false peer data.
  connectToNode(ip: string, port: number) {

    // Establish connection.
    const _socket = net.createConnection({
      port: port,
      host: ip
    });

    // Define on.connection logic and initiate the CustomSocket wrapper.
    _socket.on("connect", () => {
      // Check if it a blocked address.
      for (var blockedAddress of blocked.address) {
        if (_socket.remoteAddress == blockedAddress) {
          _socket.destroy();
        }
      }
      let socket = new CustomSocket(_socket);
      this.connections.push(socket);
      console.log(`NODE | TOTAL CONNECTION | ${this.connections.length}`);
      socket.on("close", () => {
        console.log(`NODE | REMOVED SOCKET | ${socket.remoteAddress}`);
        this.connections = this.connections.filter((_socket) => _socket !== socket);
      });
      // When receiving a new object, broadcast to all current connections.
      socket.on('ihaveobject', async (objectID) => {
        await this.broadcast(objectID, ihaveobject);
      })
      // When need an object, ask the object from everyone.
      socket.on('getobject', async (objectID) => {
        await this.broadcast(objectID, getobject);
      })
    });
  }

  // Broadcast data to other nodes.
  async broadcast(id: string, json: any) {
    // Construct ihaveobject message
    var broadcastedJSON = json;
    broadcastedJSON.objectid = id;

    console.log(`NODE | Broadcasting | ${broadcastedJSON.type} | ${id}`);

    this.connections.forEach((socket) => {
      // Send to other nodes.
      socket.write(broadcastedJSON);
    });
  }

}