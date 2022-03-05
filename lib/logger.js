"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const me_logger_1 = __importDefault(require("me-logger"));
const loggerInstance = new me_logger_1.default(me_logger_1.default.Console, { layout: { type: 'pattern', pattern: `%[[%d{yyyy/MM/dd-hh:mm:ss}][%p]%] - %m` } }, 'default');
exports.default = (level, msg) => loggerInstance[level](`${msg}`);
//# sourceMappingURL=logger.js.map