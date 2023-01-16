// Import Libraries
import { MarabuNode } from '../classes/MarabuNode';

// The port on which the server is listening.
const PORT = 18018;

let node = new MarabuNode(PORT);

node.connectToNode('45.63.84.226',18018);
