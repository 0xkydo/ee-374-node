"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chainManager = void 0;
const block_1 = require("./block");
const logger_1 = require("./logger");
class ChainManager {
    constructor() {
        this.longestChainHeight = 0;
        this.longestChainTip = null;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.longestChainTip = yield block_1.Block.makeGenesis();
        });
    }
    onValidBlockArrival(block) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!block.valid) {
                throw new Error(`Received onValidBlockArrival() call for invalid block ${block.blockid}`);
            }
            const height = block.height;
            if (this.longestChainTip === null) {
                throw new Error('We do not have a local chain to compare against');
            }
            if (height === undefined) {
                throw new Error(`We received a block ${block.blockid} we thought was valid, but had no calculated height.`);
            }
            if (height > this.longestChainHeight) {
                logger_1.logger.debug(`New longest chain has height ${height} and tip ${block.blockid}`);
                this.longestChainHeight = height;
                this.longestChainTip = block;
            }
        });
    }
}
exports.chainManager = new ChainManager();
