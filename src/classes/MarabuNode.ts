import Net from 'net';
import { CustomSocket } from './CustomSocket';

export class MarabuNode {

  private _server: Net.Server;

  connections: CustomSocket[] = [];

  constructor(PORT: number) {
    this._server = Net.createServer((_socket) => {
      let socket = new CustomSocket(_socket);
      this.connections.push(socket);
      socket.on('data', (data) => { });
      socket.on("end", () => {
        this.connections = this.connections.filter((_socket) => _socket !== socket);
        console.log(`Client disconnected: ${socket.remoteAddress}`);
        console.log(`Current total connection: ${this.connections.length}`);
      });
    })
    this._server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening for connection requests on socket at ${PORT}`);
    });

  }

  connectToNode(ip: string, port: number) {
    const _socket = Net.createConnection({
      port: port,
      host: ip
    });
    _socket.on("connect", () => {
      let socket = new CustomSocket(_socket);
      this.connections.push(socket);
      socket.on('data', (data) => { });
      socket.on("end", () => {
        console.log(`Disconnected from ${ip}:${port}`);
        this.connections = this.connections.filter((_socket) => _socket !== socket);
      });
    });
  }

  broadcast(data: any, sender: CustomSocket) {
    this.connections.forEach((socket) => {
      if (socket === sender) return;
      socket.write(data);
    });

  }

}