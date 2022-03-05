import { Action } from 'me-actions';
import IContext from './context';
export interface IDownloadConfig {
    url: string;
    ext: string;
    saveRelativePath: string;
    overwrite?: boolean;
    savePath?: string;
    tmpPath?: string;
    exists?: boolean;
}
export declare function pre(context: IContext, c: IDownloadConfig): IDownloadConfig;
export declare function getProxyAgent(proxy: string): {
    httpAgent: import("socks-proxy-agent/dist/agent").default;
    httpsAgent: import("socks-proxy-agent/dist/agent").default;
} | {
    httpAgent: import("http-proxy-agent/dist/agent").default;
    httpsAgent: import("https-proxy-agent/dist/agent").default;
};
export declare class ActionForDownloadFile extends Action {
    private config;
    private progressText;
    private canceler;
    private dp;
    constructor(config: IDownloadConfig, progress?: (number | string)[]);
    protected doStart(context: IContext): Promise<IDownloadConfig>;
}
declare const _default: {
    doOne(context: IContext, dconfig: IDownloadConfig, progress?: (number | string)[]): Promise<import("me-actions").IResult>;
    doBatch(context: IContext, dconfigs: IDownloadConfig[]): Promise<any>;
};
export default _default;
