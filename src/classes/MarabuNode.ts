import Net from 'net';
import { CustomSocket } from './CustomSocket';

export class MarabuNode {

  private _server: Net.Server;

  connections: CustomSocket[] = [];

  // Constructor initiate the node. It establishes the server, wrap and push 
  // the socket to the node class for record keeping.
  constructor(PORT: number) {
    this._server = Net.createServer((_socket) => {
      let socket = new CustomSocket(_socket);
      this.connections.push(socket);
      console.log(`Current total connection: ${this.connections.length}`);
      socket.on('data', (data) => { });
      socket.on('close', () => {
        this.connections = this.connections.filter((_socket) => _socket !== socket);
        console.log(`Client disconnected: ${socket.remoteAddress}`);
        console.log(`Current total connection: ${this.connections.length}`);
      });
    })
    this._server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening for connection requests on socket at ${PORT}`);
    });

  }

  // Method for connecting to another node.
  // TODO currently it does not check if the inputs are actually string and 
  // numbers. This can cause the node to go offline if adversary passes in 
  // false peer data.
  connectToNode(ip: string, port: number) {
    
    // Establish connection.
    const _socket = Net.createConnection({
      port: port,
      host: ip
    });
    
    // Define on.connection logic and initiate the CustomSocket wrapper.
    _socket.on("connect", () => {
      let socket = new CustomSocket(_socket);
      this.connections.push(socket);
      console.log(`Current total connection: ${this.connections.length}`);
      socket.on('data', (data) => { });
      socket.on("close", () => {
        console.log(`Disconnected from ${ip}:${port}`);
        this.connections = this.connections.filter((_socket) => _socket !== socket);
      });
    });
  }

  // Broadcast data to other nodes.
  broadcast(data: any, sender: CustomSocket) {
    this.connections.forEach((socket) => {
      if (socket === sender) return;
      socket.write(data);
    });
  }

}