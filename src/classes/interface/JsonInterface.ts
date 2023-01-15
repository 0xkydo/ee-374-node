export interface ErrorJSON {
  type: string;
  name: string;
  message: string;
}
export interface HelloJSON {
  type: string;
  version: string;
  agent: string;
}

export interface PeerJSON {
  type: string;
  peers: string[];
}