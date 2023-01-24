import level from 'level-ts';
import net from 'net';
import { CustomSocket } from './CustomSocket';

import { DATABASE_PATH } from '../constants'


export class MarabuNode {

  private _server: net.Server;
  private _db = new level(DATABASE_PATH);

  connections: CustomSocket[] = [];

  // Constructor initiate the node. It establishes the server, wrap and push 
  // the socket to the node class for record keeping.
  constructor(PORT: number) {
    this._server = net.createServer((_socket) => {
      let socket = new CustomSocket(_socket);
      this.connections.push(socket);
      console.log(`NODE | TOTAL CONNECTION | ${this.connections.length}`);
      socket.on('close', () => {
        console.log(`NODE | REMOVED SOCKET | ${socket.remoteAddress}`);
        this.connections = this.connections.filter((_socket) => _socket !== socket);
        console.log(`NODE | TOTAL CONNECTION | ${this.connections.length}`);
      });
      // When receiving a new object, broadcast to all current connections.
      socket.on('object', async (objectID)=>{
        await this.broadcast(objectID,socket);
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
      let socket = new CustomSocket(_socket);
      this.connections.push(socket);
      console.log(`NODE | TOTAL CONNECTION | ${this.connections.length}`);
      socket.on("close", () => {
        console.log(`NODE | REMOVED SOCKET | ${socket.remoteAddress}`);
        this.connections = this.connections.filter((_socket) => _socket !== socket);
      });
      socket.on('object', async (objectID)=>{
        await this.broadcast(objectID,socket);
      })
    });
  }

  // Broadcast data to other nodes.
  async broadcast(id: string, sender: CustomSocket) {
    // Fetch data
    var object = await this._db.get(id);

    this.connections.forEach((socket) => {
      // Do not send to the node who send the object.
      if (socket === sender) return;

      // Send to other nodes.
      socket.write(object);
      
    });
  }

}