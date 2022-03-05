import fs from 'fs';
import path from 'path';
import https from 'https';
import url from 'url';
import { clearInterval } from 'timers';
import axios from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Action, IDeferer, RunQueue } from 'me-actions';
import IContext from './context';
import logger from './logger';
import { defaultUserAgent } from './puppeteer';

//下载器
export interface IDownloadConfig {
  url: string;
  ext: string;
  saveRelativePath: string;
  overwrite?: boolean;
  //
  savePath?: string;
  tmpPath?: string;
  exists?: boolean;
}

export function pre(context: IContext, c: IDownloadConfig) {
  //url
  c.url = c.url.startsWith('/') ? `${context.url}${c.url}` : c.url;
  c.ext = c.ext.toLowerCase();
  c.savePath = path.resolve(context.dlPath, `${c.saveRelativePath}${c.ext}`);
  c.tmpPath = `${c.savePath}.tmp`;
  c.exists = !c.overwrite && fs.existsSync(c.savePath);
  if (fs.existsSync(c.tmpPath)) fs.unlinkSync(c.tmpPath);
  //
  return c;
}

export function getProxyAgent(proxy: string) {
  const options = { ...url.parse(proxy), agentOptions: { keepAlive: true, rejectUnauthorized: false } };
  if (proxy.startsWith('socks')) {
    return { httpAgent: new SocksProxyAgent(options), httpsAgent: new SocksProxyAgent(options) };
  }
  return { httpAgent: new HttpProxyAgent(options), httpsAgent: new HttpsProxyAgent(options) };
}

//HTTP Client 下载
export class ActionForDownloadFile extends Action {
  private config: IDownloadConfig;
  private progressText: string = '';
  private canceler: any;
  private dp: IDeferer;

  constructor(config: IDownloadConfig, progress?: (number | string)[]) {
    super();
    this.config = config;
    if (progress) this.progressText = `[${progress[0]}/${progress[1]}]`;
  }
  protected async doStart(context: IContext) {
    let c = pre(context, this.config);
    if (c.exists) return c;
    //
    let headers: any = { 'upgrade-insecure-requests': 1, 'user-agent': defaultUserAgent, referer: context.url };
    let proxy: any = context.proxy ? getProxyAgent(context.proxy) : {};
    //
    logger('debug', `开始下载 ${c.url} ${this.progressText} ${proxy.httpsAgent ? `(with Proxy) ` : ''}`);
    //
    if (!fs.existsSync(path.dirname(c.savePath))) fs.mkdirSync(path.dirname(c.savePath));
    if (fs.existsSync(c.tmpPath)) fs.unlinkSync(c.tmpPath);
    const ws = fs.createWriteStream(c.tmpPath);
    await new Promise((resolve) => ws.on('open', resolve));
    //
    this.canceler = axios.CancelToken.source();
    let timeout: any;
    let response: any;
    try {
      timeout = setTimeout(() => this.canceler.cancel(), 30000);
      response = await axios.request({
        url: c.url,
        method: 'GET',
        headers,
        responseType: 'stream',
        timeout: 30000,
        cancelToken: this.canceler.token,
        httpAgent: proxy.httpAgent,
        httpsAgent: proxy.httpsAgent || new https.Agent({ rejectUnauthorized: false }),
      });
      clearTimeout(timeout);
      timeout = undefined;
    } catch (e) {
      clearTimeout(timeout);
      timeout = undefined;
      //
      let errMsg;
      if (axios.isCancel(e)) {
        errMsg = `连接超时 > 30000 ms`;
      } else {
        errMsg = `下载出错 ${e.message}，${e.stack}`;
      }
      ws.end();
      this.canceler.cancel(errMsg);
      throw new Error(errMsg);
    }
    if (!this.isPending()) return c;
    //
    this.dp = Action.defer();
    let ms = Date.now();
    timeout = setInterval(() => {
      if (Date.now() - ms <= 30000) return;
      //
      clearInterval(timeout);
      timeout = undefined;
      ws.end();
      //
      const errMsg = `接收数据超时 > 30000 ms`;
      this.canceler.cancel(errMsg);
      this.dp.reject(new Error(errMsg));
      //
    }, 1000);
    //
    response.data.pipe(ws);
    response.data.on('data', () => {
      ms = Date.now();
    });
    response.data.on('end', () => {
      ms = Date.now();
      ws.end(() => {
        clearInterval(timeout);
        timeout = undefined;
        this.canceler = undefined;
        //
        let err;
        try {
          fs.renameSync(c.tmpPath, c.savePath);
        } catch (e) {
          if (!fs.existsSync(c.savePath)) err = e;
        }
        if (err) {
          let errMsg = `下载完成，无法保存至 ${c.savePath}，${err.stack}`;
          this.dp.reject(new Error(errMsg));
        } else {
          logger('info', `下载完成，保存至 ${c.savePath}`);
          if (fs.existsSync(c.tmpPath)) fs.unlinkSync(c.tmpPath);
          this.dp.resolve(c);
        }
      });
    });
    //
    await this.dp.p;
    return c;
  }
}

//下载中心
let _queue: RunQueue;
const getQueue = () => {
  if (!_queue) _queue = new RunQueue(10, 'manual', 0).start();
  return _queue;
};

export default {
  async doOne(context: IContext, dconfig: IDownloadConfig, progress?: (number | string)[]) {
    return getQueue().doOne(new ActionForDownloadFile(dconfig, progress), context);
  },
  async doBatch(context: IContext, dconfigs: IDownloadConfig[]) {
    const all = [];
    for (let i = 0; i < dconfigs.length; i++) {
      all.push(getQueue().doOne(new ActionForDownloadFile(dconfigs[i], [i + 1, dconfigs.length]), context));
    }
    const results = await Promise.all(all);
    for (let r of results) {
      if (r.action.isRejected()) return r.err;
    }
  },
};
