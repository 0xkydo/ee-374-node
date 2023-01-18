import { isIP } from "net";
const isValidDomain = require('is-valid-domain')

import errors from "../../FIXED_MESSAGES/errors.json"

export default function formatChecker(obj: any): [boolean, any] {

  switch (obj.type) {
    case 'transaction':
      break;
    case 'block':
      break;
    case 'hello':
      if (obj.version.slice(0, -1) === "0.9.") {
        return [true, null];
      } else {
        return [false,errors.INVALID_FORMAT];
      }
    case 'error':
      break;
    case 'getpeers':
      break;
    case 'peers':
      // Check if all peers are in valid formats.
      for(var peer of obj.peers){

        // Check if format is correct and only has 1 ":"
        if(peer.split(":").length!==2){
          return [false,errors.INVALID_FORMAT];
        }

        // Parse IP and PORT number.
        var IP = peer.split(":")[0];
        var PORT = Number(peer.split(":")[1]);
        // Check if the IP is IP, and the PORT is number 1-65535.
        if(!isIP(IP) || PORT < 1 || PORT > 65535 ){
          if(!isValidDomain(IP) || PORT < 1 || PORT > 65535){
            return [false,errors.INVALID_FORMAT];
          }
        }
      }
      break;
    case 'getobject':
      break;
    case 'ihaveobject':
      break;
    case 'object':
      break;
    case 'getmempool':
      break;
    case 'mempool':
      break;
    case 'getchaintip':
      break;
    case 'chaintip':
      break;
    default:
      return [false,errors.INVALID_FORMAT];
  }

  return [true,null];


}