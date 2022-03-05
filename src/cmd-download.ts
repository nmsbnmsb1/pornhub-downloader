import fs from 'fs';
import path from 'path';
import IContext from './context';
import logger from './logger';
import PuppeteerUtils, { e_commutils } from './puppeteer';
import downloader, { IDownloadConfig, pre } from './downloader';

interface IPornhubContext extends IContext {
  pornhubID: string;
  pornhubWatch: boolean;
}
interface IPornhubPorn {
  serial_id: string;
  url: string;
  title: string;
  local_name: string;
  promo: string;
  status: string;
  porns: IPornhubStreamPorn[];
  porn: IPornhubStreamPorn;
}
interface IPornhubStreamPorn {
  defaultQuality: boolean;
  format: string;
  videoUrl: string;
  quality: any;
  remote: boolean;
}
interface IInfo {
  PROGRAMID: string;
  BANDWIDTH: string;
  RESOLUTION: number[];
  FRAMERATE: string;
  CODECS: string;
  URL: string;
}
function e_porndetail(porn: IPornhubPorn) {
  if (document.head.querySelector("meta[property='og:title']")) {
    porn.title = document.head.querySelector("meta[property='og:title']").getAttribute('content');
    porn.local_name = `[${porn.serial_id}] ${this.trimLocalName(porn.title)}`;
  } else {
    porn.title = porn.status = 'unavaliable';
    porn.local_name = `[${porn.serial_id}] unavaliable`;
  }
  if (porn.promo === 'unavaliable') return porn;
  //
  porn.promo = 'free';
  if (document.querySelector("div[class='wrapper'] div[class='geoBlocked']")) {
    porn.promo = porn.status = 'unavaliable';
    porn.local_name = `[${porn.serial_id}] unavailable`;
    //
  } else if (document.querySelector("div[class='removed'] div[class='notice video-notice']")) {
    porn.promo = porn.status = 'unavaliable';
    porn.local_name = `[${porn.serial_id}] unavailable`;
    //
  } else if (document.querySelector("div[id='vpContentContainer'] section[class='noVideo']")) {
    if (
      (document.querySelector("div[id='vpContentContainer'] section[class='noVideo']") as any).innerText.indexOf('Video is unavailable pending review') >= 0
    ) {
      porn.promo = porn.status = 'unavaliable';
      porn.local_name = `[${porn.serial_id}] unavailable`;
    }
  } else if (document.querySelector("div[class='premiumLockedPartners']")) {
    porn.promo = 'premium';
    //
  } else if (document.querySelector("div[id='vpContentContainer'] button[class*='orangeButton purchaseButton']")) {
    porn.promo = 'pay';
    //
  } else if (document.querySelector("div[id='vpContentContainer'] div[class*='js-paidDownload'] span[class='pay2Download']")) {
    porn.promo = 'pay';
    //
  }
  if (porn.promo === 'unavaliable' || porn.promo === 'premium') return porn;
  //
  porn.porns = [];
  if (porn.promo === 'free') {
    porn.porns = this[`flashvars_${document.querySelector("div[id='vpContentContainer'] div[id='player']").getAttribute('data-video-id')}`].mediaDefinitions;
  }
  return porn;
}
function parseM3u8Info(infoStr: string, url: string) {
  const info: IInfo = {} as any;
  let content = infoStr.substring(infoStr.indexOf(':') + 1);
  //#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=3977116,RESOLUTION=1920x1080,FRAME-RATE=59.920,CODECS="avc1.640032,mp4a.40.2"
  //let i = 0;
  while (content.length > 0) {
    //console.log('=====================');
    const equalIndex = content.indexOf('=');
    const key = content.substring(0, equalIndex).replace('-', '');
    content = content.substring(equalIndex + 1);
    //console.log(key, content);
    //
    let value = '';
    let endIndex;
    if (content.startsWith('"')) {
      endIndex = content.indexOf('"', 1);
      value = content.substring(1, endIndex);
    } else {
      endIndex = content.indexOf(',');
      value = content.substring(0, endIndex);
    }
    content = content.substring(endIndex + 1);
    if (content.startsWith(',')) content = content.substring(1);
    //console.log(value, content);
    //
    info[key] = value;
  }
  if (info.RESOLUTION) {
    const rtmp = (info.RESOLUTION as any).split('x');
    info.RESOLUTION = [parseInt(rtmp[0], 10), parseInt(rtmp[1], 10)];
  }
  info.URL = url;
  return info;
}
const Utils: any = {};
e_commutils.bind(Utils)();

export default async (context: IPornhubContext) => {
  await PuppeteerUtils.openBrowser(context, true);
  //
  let name = '下载';
  let url = `${context.url}/view_video.php?viewkey=${context.pornhubID}`;
  let porn: IPornhubPorn = { serial_id: context.pornhubID, url } as any;
  //
  logger('info', `打开视频页 ${url}`);
  const page = await PuppeteerUtils.openPage();
  await page.goto(url);
  await page.evaluate(e_commutils);
  porn = await page.evaluate(e_porndetail, porn as any);
  if (porn.promo !== 'free' && porn.promo !== 'pay') throw new Error(`无法下载: ${porn.title}  Promo: ${porn.promo}`);
  logger('info', `porns -> ${JSON.stringify(porn.porns, undefined, 4)}`);
  //
  let getm: IPornhubStreamPorn;
  {
    let hls;
    for (let i = 0; i < porn.porns.length; i++) {
      let p = porn.porns[i];
      if (Array.isArray(p.quality) && p.quality.length > 0) {
        getm = p;
        break;
      }
      if (!hls && p.format === 'hls' && p.defaultQuality === true) hls = p;
    }
    if (!getm && hls) getm = hls;
  }
  if (!getm) throw new Error(`无法下载: ${porn.title} 没有找到可以下载的文件`);
  logger('info', `get_media -> ${JSON.stringify(getm, undefined, 4)}`);

  //下载视频的.m3u8文件
  let getmData: any;
  //下载 get_media
  {
    const savePath = `${porn.local_name}/get_media`;
    const result = await downloader.doOne(context, { url: getm.videoUrl, saveRelativePath: savePath, ext: '.txt', overwrite: true });
    if (result.err) throw result.err;
    getmData = fs.readFileSync(result.data.savePath).toString();
  }
  //可能是json可能是m3u8
  //-> 1. json->m3u8->down
  //-> 2. ->m3u8->down
  let m3u8Data: string;
  if (getmData.startsWith('{')) {
    getmData = JSON.parse(getmData);
    logger('info', `get_media.json -> ${JSON.stringify(getmData, undefined, 4)}`);

    //确定 master.m3u8
    for (let i = 0; i < getmData.length; i++) {
      if (Array.isArray(getmData[i].quality)) {
        porn.porn = getmData[i];
        break;
      }
    }
    if (!porn.porn) porn.porn = getmData[getmData.length - 1];
    logger('info', `master.m3u8 -> ${JSON.stringify(porn.porn, undefined, 4)}`);

    //下载 master.m3u8
    const savePath = `${porn.local_name}/master`;
    const result = await downloader.doOne(context, { url: porn.porn.videoUrl, saveRelativePath: savePath, ext: '.m3u8', overwrite: true });
    if (result.err) throw result.err;
    m3u8Data = fs.readFileSync(result.data.savePath).toString();
    //
  } else if (getmData.startsWith('#EXTM3U')) {
    porn.porn = { videoUrl: `${getm.videoUrl.substring(0, getm.videoUrl.lastIndexOf('/'))}/master.m3u8` } as any;
    logger('info', `master.m3u8 -> ${JSON.stringify(porn.porn, undefined, 4)}`);
    //getmData 本身就是 master.m3u8
    fs.renameSync(`${context.dlPath}/${porn.local_name}/get_media.txt`, `${context.dlPath}/${porn.local_name}/master.m3u8`);
    m3u8Data = getmData;
  }
  //
  //解析 master.m3u8
  let wanted: IInfo;
  {
    let infos = m3u8Data.split('\n');
    for (let i = 0; i < infos.length; i++) {
      if (infos[i].startsWith('#EXT-X-STREAM-INF:')) {
        const info = parseM3u8Info(infos[i], infos[++i]);
        if (!wanted || wanted.RESOLUTION[1] < info.RESOLUTION[1]) wanted = info;
      }
    }
  }
  logger('info', `wanted -> ${JSON.stringify(wanted, undefined, 4)}`);
  //
  if (context.pornhubWatch) {
    await PuppeteerUtils.closeBrowser();
    return;
  }
  //
  //下载m3u8
  let m3u8: string;
  {
    const result = await downloader.doOne(context, {
      url: `${porn.porn.videoUrl.substring(0, porn.porn.videoUrl.lastIndexOf('/'))}/${wanted.URL}`,
      saveRelativePath: `${porn.local_name}/${Utils.localNameFromURL(wanted.URL)}`,
      ext: '.m3u8',
      overwrite: true,
    });
    if (result.err) throw result.err;
    m3u8 = fs.readFileSync(result.data.savePath).toString();
  }

  //下载视频
  const dconfig = { url: porn.porn.videoUrl, saveRelativePath: `${porn.local_name}/${wanted.RESOLUTION[1]}`, ext: `.ts` };
  const finalPath = path.join(context.dlPath, `${dconfig.saveRelativePath}${dconfig.ext}`);
  if (!fs.existsSync(finalPath)) {
    const urlPrefix = dconfig.url.substring(0, dconfig.url.lastIndexOf('/'));
    const dirPath = path.dirname(dconfig.saveRelativePath);
    const tss: string[] = m3u8.split('\n').filter((url) => url.match(/\.ts/));
    //创建下载文件
    const ds: IDownloadConfig[] = [];
    for (let i = 0; i < tss.length; i++) {
      ds[i] = pre(context, {
        url: `${urlPrefix}/${tss[i]}`,
        saveRelativePath: `${dirPath}/${tss[i].substring(0, tss[i].indexOf('.'))}`,
        ext: '.ts',
        overwrite: false,
      } as any);
    }
    //
    const err = await downloader.doBatch(context, ds);
    if (err) throw err;
    //合并所有文件
    for (const d of ds) {
      fs.appendFileSync(finalPath, fs.readFileSync(d.savePath));
      fs.unlinkSync(d.savePath);
    }
  }
  //
  await PuppeteerUtils.closeBrowser();
};
