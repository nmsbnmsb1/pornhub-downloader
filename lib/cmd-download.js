"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./logger"));
const puppeteer_1 = __importStar(require("./puppeteer"));
const downloader_1 = __importStar(require("./downloader"));
function e_porndetail(porn) {
    if (document.head.querySelector("meta[property='og:title']")) {
        porn.title = document.head.querySelector("meta[property='og:title']").getAttribute('content');
        porn.local_name = `[${porn.serial_id}] ${this.trimLocalName(porn.title)}`;
    }
    else {
        porn.title = porn.status = 'unavaliable';
        porn.local_name = `[${porn.serial_id}] unavaliable`;
    }
    if (porn.promo === 'unavaliable')
        return porn;
    porn.promo = 'free';
    if (document.querySelector("div[class='wrapper'] div[class='geoBlocked']")) {
        porn.promo = porn.status = 'unavaliable';
        porn.local_name = `[${porn.serial_id}] unavailable`;
    }
    else if (document.querySelector("div[class='removed'] div[class='notice video-notice']")) {
        porn.promo = porn.status = 'unavaliable';
        porn.local_name = `[${porn.serial_id}] unavailable`;
    }
    else if (document.querySelector("div[id='vpContentContainer'] section[class='noVideo']")) {
        if (document.querySelector("div[id='vpContentContainer'] section[class='noVideo']").innerText.indexOf('Video is unavailable pending review') >= 0) {
            porn.promo = porn.status = 'unavaliable';
            porn.local_name = `[${porn.serial_id}] unavailable`;
        }
    }
    else if (document.querySelector("div[class='premiumLockedPartners']")) {
        porn.promo = 'premium';
    }
    else if (document.querySelector("div[id='vpContentContainer'] button[class*='orangeButton purchaseButton']")) {
        porn.promo = 'pay';
    }
    else if (document.querySelector("div[id='vpContentContainer'] div[class*='js-paidDownload'] span[class='pay2Download']")) {
        porn.promo = 'pay';
    }
    if (porn.promo === 'unavaliable' || porn.promo === 'premium')
        return porn;
    porn.porns = [];
    if (porn.promo === 'free') {
        porn.porns = this[`flashvars_${document.querySelector("div[id='vpContentContainer'] div[id='player']").getAttribute('data-video-id')}`].mediaDefinitions;
    }
    return porn;
}
function parseM3u8Info(infoStr, url) {
    const info = {};
    let content = infoStr.substring(infoStr.indexOf(':') + 1);
    while (content.length > 0) {
        const equalIndex = content.indexOf('=');
        const key = content.substring(0, equalIndex).replace('-', '');
        content = content.substring(equalIndex + 1);
        let value = '';
        let endIndex;
        if (content.startsWith('"')) {
            endIndex = content.indexOf('"', 1);
            value = content.substring(1, endIndex);
        }
        else {
            endIndex = content.indexOf(',');
            value = content.substring(0, endIndex);
        }
        content = content.substring(endIndex + 1);
        if (content.startsWith(','))
            content = content.substring(1);
        info[key] = value;
    }
    if (info.RESOLUTION) {
        const rtmp = info.RESOLUTION.split('x');
        info.RESOLUTION = [parseInt(rtmp[0], 10), parseInt(rtmp[1], 10)];
    }
    info.URL = url;
    return info;
}
const Utils = {};
puppeteer_1.e_commutils.bind(Utils)();
exports.default = async (context) => {
    await puppeteer_1.default.openBrowser(context, true);
    let name = '下载';
    let url = `${context.url}/view_video.php?viewkey=${context.pornhubID}`;
    let porn = { serial_id: context.pornhubID, url };
    (0, logger_1.default)('info', `打开视频页 ${url}`);
    const page = await puppeteer_1.default.openPage();
    await page.goto(url);
    await page.evaluate(puppeteer_1.e_commutils);
    porn = await page.evaluate(e_porndetail, porn);
    if (porn.promo !== 'free' && porn.promo !== 'pay')
        throw new Error(`无法下载: ${porn.title}  Promo: ${porn.promo}`);
    (0, logger_1.default)('info', `porns -> ${JSON.stringify(porn.porns, undefined, 4)}`);
    let getm;
    {
        let hls;
        for (let i = 0; i < porn.porns.length; i++) {
            let p = porn.porns[i];
            if (Array.isArray(p.quality) && p.quality.length > 0) {
                getm = p;
                break;
            }
            if (!hls && p.format === 'hls' && p.defaultQuality === true)
                hls = p;
        }
        if (!getm && hls)
            getm = hls;
    }
    if (!getm)
        throw new Error(`无法下载: ${porn.title} 没有找到可以下载的文件`);
    (0, logger_1.default)('info', `get_media -> ${JSON.stringify(getm, undefined, 4)}`);
    let getmData;
    {
        const savePath = `${porn.local_name}/get_media`;
        const result = await downloader_1.default.doOne(context, { url: getm.videoUrl, saveRelativePath: savePath, ext: '.txt', overwrite: true });
        if (result.err)
            throw result.err;
        getmData = fs_1.default.readFileSync(result.data.savePath).toString();
    }
    let m3u8Data;
    if (getmData.startsWith('{')) {
        getmData = JSON.parse(getmData);
        (0, logger_1.default)('info', `get_media.json -> ${JSON.stringify(getmData, undefined, 4)}`);
        for (let i = 0; i < getmData.length; i++) {
            if (Array.isArray(getmData[i].quality)) {
                porn.porn = getmData[i];
                break;
            }
        }
        if (!porn.porn)
            porn.porn = getmData[getmData.length - 1];
        (0, logger_1.default)('info', `master.m3u8 -> ${JSON.stringify(porn.porn, undefined, 4)}`);
        const savePath = `${porn.local_name}/master`;
        const result = await downloader_1.default.doOne(context, { url: porn.porn.videoUrl, saveRelativePath: savePath, ext: '.m3u8', overwrite: true });
        if (result.err)
            throw result.err;
        m3u8Data = fs_1.default.readFileSync(result.data.savePath).toString();
    }
    else if (getmData.startsWith('#EXTM3U')) {
        porn.porn = { videoUrl: `${getm.videoUrl.substring(0, getm.videoUrl.lastIndexOf('/'))}/master.m3u8` };
        (0, logger_1.default)('info', `master.m3u8 -> ${JSON.stringify(porn.porn, undefined, 4)}`);
        fs_1.default.renameSync(`${context.dlPath}/${porn.local_name}/get_media.txt`, `${context.dlPath}/${porn.local_name}/master.m3u8`);
        m3u8Data = getmData;
    }
    let wanted;
    {
        let infos = m3u8Data.split('\n');
        for (let i = 0; i < infos.length; i++) {
            if (infos[i].startsWith('#EXT-X-STREAM-INF:')) {
                const info = parseM3u8Info(infos[i], infos[++i]);
                if (!wanted || wanted.RESOLUTION[1] < info.RESOLUTION[1])
                    wanted = info;
            }
        }
    }
    (0, logger_1.default)('info', `wanted -> ${JSON.stringify(wanted, undefined, 4)}`);
    if (context.pornhubWatch) {
        await puppeteer_1.default.closeBrowser();
        return;
    }
    let m3u8;
    {
        const result = await downloader_1.default.doOne(context, {
            url: `${porn.porn.videoUrl.substring(0, porn.porn.videoUrl.lastIndexOf('/'))}/${wanted.URL}`,
            saveRelativePath: `${porn.local_name}/${Utils.localNameFromURL(wanted.URL)}`,
            ext: '.m3u8',
            overwrite: true,
        });
        if (result.err)
            throw result.err;
        m3u8 = fs_1.default.readFileSync(result.data.savePath).toString();
    }
    const dconfig = { url: porn.porn.videoUrl, saveRelativePath: `${porn.local_name}/${wanted.RESOLUTION[1]}`, ext: `.ts` };
    const finalPath = path_1.default.join(context.dlPath, `${dconfig.saveRelativePath}${dconfig.ext}`);
    if (!fs_1.default.existsSync(finalPath)) {
        const urlPrefix = dconfig.url.substring(0, dconfig.url.lastIndexOf('/'));
        const dirPath = path_1.default.dirname(dconfig.saveRelativePath);
        const tss = m3u8.split('\n').filter((url) => url.match(/\.ts/));
        const ds = [];
        for (let i = 0; i < tss.length; i++) {
            ds[i] = (0, downloader_1.pre)(context, {
                url: `${urlPrefix}/${tss[i]}`,
                saveRelativePath: `${dirPath}/${tss[i].substring(0, tss[i].indexOf('.'))}`,
                ext: '.ts',
                overwrite: false,
            });
        }
        const err = await downloader_1.default.doBatch(context, ds);
        if (err)
            throw err;
        for (const d of ds) {
            fs_1.default.appendFileSync(finalPath, fs_1.default.readFileSync(d.savePath));
            fs_1.default.unlinkSync(d.savePath);
        }
    }
    await puppeteer_1.default.closeBrowser();
};
//# sourceMappingURL=cmd-download.js.map