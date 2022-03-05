"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionForDownloadFile = exports.getProxyAgent = exports.pre = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const url_1 = __importDefault(require("url"));
const timers_1 = require("timers");
const axios_1 = __importDefault(require("axios"));
const http_proxy_agent_1 = require("http-proxy-agent");
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const me_actions_1 = require("me-actions");
const logger_1 = __importDefault(require("./logger"));
const puppeteer_1 = require("./puppeteer");
function pre(context, c) {
    c.url = c.url.startsWith('/') ? `${context.url}${c.url}` : c.url;
    c.ext = c.ext.toLowerCase();
    c.savePath = path_1.default.resolve(context.dlPath, `${c.saveRelativePath}${c.ext}`);
    c.tmpPath = `${c.savePath}.tmp`;
    c.exists = !c.overwrite && fs_1.default.existsSync(c.savePath);
    if (fs_1.default.existsSync(c.tmpPath))
        fs_1.default.unlinkSync(c.tmpPath);
    return c;
}
exports.pre = pre;
function getProxyAgent(proxy) {
    const options = Object.assign(Object.assign({}, url_1.default.parse(proxy)), { agentOptions: { keepAlive: true, rejectUnauthorized: false } });
    if (proxy.startsWith('socks')) {
        return { httpAgent: new socks_proxy_agent_1.SocksProxyAgent(options), httpsAgent: new socks_proxy_agent_1.SocksProxyAgent(options) };
    }
    return { httpAgent: new http_proxy_agent_1.HttpProxyAgent(options), httpsAgent: new https_proxy_agent_1.HttpsProxyAgent(options) };
}
exports.getProxyAgent = getProxyAgent;
class ActionForDownloadFile extends me_actions_1.Action {
    constructor(config, progress) {
        super();
        this.progressText = '';
        this.config = config;
        if (progress)
            this.progressText = `[${progress[0]}/${progress[1]}]`;
    }
    async doStart(context) {
        let c = pre(context, this.config);
        if (c.exists)
            return c;
        let headers = { 'upgrade-insecure-requests': 1, 'user-agent': puppeteer_1.defaultUserAgent, referer: context.url };
        let proxy = context.proxy ? getProxyAgent(context.proxy) : {};
        (0, logger_1.default)('debug', `开始下载 ${c.url} ${this.progressText} ${proxy.httpsAgent ? `(with Proxy) ` : ''}`);
        if (!fs_1.default.existsSync(path_1.default.dirname(c.savePath)))
            fs_1.default.mkdirSync(path_1.default.dirname(c.savePath));
        if (fs_1.default.existsSync(c.tmpPath))
            fs_1.default.unlinkSync(c.tmpPath);
        const ws = fs_1.default.createWriteStream(c.tmpPath);
        await new Promise((resolve) => ws.on('open', resolve));
        this.canceler = axios_1.default.CancelToken.source();
        let timeout;
        let response;
        try {
            timeout = setTimeout(() => this.canceler.cancel(), 30000);
            response = await axios_1.default.request({
                url: c.url,
                method: 'GET',
                headers,
                responseType: 'stream',
                timeout: 30000,
                cancelToken: this.canceler.token,
                httpAgent: proxy.httpAgent,
                httpsAgent: proxy.httpsAgent || new https_1.default.Agent({ rejectUnauthorized: false }),
            });
            clearTimeout(timeout);
            timeout = undefined;
        }
        catch (e) {
            clearTimeout(timeout);
            timeout = undefined;
            let errMsg;
            if (axios_1.default.isCancel(e)) {
                errMsg = `连接超时 > 30000 ms`;
            }
            else {
                errMsg = `下载出错 ${e.message}，${e.stack}`;
            }
            ws.end();
            this.canceler.cancel(errMsg);
            throw new Error(errMsg);
        }
        if (!this.isPending())
            return c;
        this.dp = me_actions_1.Action.defer();
        let ms = Date.now();
        timeout = setInterval(() => {
            if (Date.now() - ms <= 30000)
                return;
            (0, timers_1.clearInterval)(timeout);
            timeout = undefined;
            ws.end();
            const errMsg = `接收数据超时 > 30000 ms`;
            this.canceler.cancel(errMsg);
            this.dp.reject(new Error(errMsg));
        }, 1000);
        response.data.pipe(ws);
        response.data.on('data', () => {
            ms = Date.now();
        });
        response.data.on('end', () => {
            ms = Date.now();
            ws.end(() => {
                (0, timers_1.clearInterval)(timeout);
                timeout = undefined;
                this.canceler = undefined;
                let err;
                try {
                    fs_1.default.renameSync(c.tmpPath, c.savePath);
                }
                catch (e) {
                    if (!fs_1.default.existsSync(c.savePath))
                        err = e;
                }
                if (err) {
                    let errMsg = `下载完成，无法保存至 ${c.savePath}，${err.stack}`;
                    this.dp.reject(new Error(errMsg));
                }
                else {
                    (0, logger_1.default)('info', `下载完成，保存至 ${c.savePath}`);
                    if (fs_1.default.existsSync(c.tmpPath))
                        fs_1.default.unlinkSync(c.tmpPath);
                    this.dp.resolve(c);
                }
            });
        });
        await this.dp.p;
        return c;
    }
}
exports.ActionForDownloadFile = ActionForDownloadFile;
let _queue;
const getQueue = () => {
    if (!_queue)
        _queue = new me_actions_1.RunQueue(10, 'manual', 0).start();
    return _queue;
};
exports.default = {
    async doOne(context, dconfig, progress) {
        return getQueue().doOne(new ActionForDownloadFile(dconfig, progress), context);
    },
    async doBatch(context, dconfigs) {
        const all = [];
        for (let i = 0; i < dconfigs.length; i++) {
            all.push(getQueue().doOne(new ActionForDownloadFile(dconfigs[i], [i + 1, dconfigs.length]), context));
        }
        const results = await Promise.all(all);
        for (let r of results) {
            if (r.action.isRejected())
                return r.err;
        }
    },
};
//# sourceMappingURL=downloader.js.map