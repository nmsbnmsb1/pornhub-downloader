import path from 'path';
import puppeteer, { Page, Browser } from 'puppeteer-core';
import IContext from './context';

export const defaultUserAgent: string =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36';

export function e_commutils() {
  this.trimLocalName = (localName: string, maxLength: number = 243) => {
    //\/:*?"<>|
    localName = localName
      .replace(/[\r\n]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[\\\/:*?\"<>|]/g, ' ')
      .replace(/\.$/g, '')
      .replace(/…/, ' ')
      .trim();
    if (localName.length > maxLength) localName = localName.substring(0, maxLength);
    return localName;
  };
  this.localNameFromURL = (url: string) => {
    if (url.endsWith('/')) url = url.substring(0, url.length - 1);
    url = url.substring(url.lastIndexOf('/') + 1);
    if (url.indexOf('&') > 0) url = url.substring(0, url.indexOf('&'));
    if (url.lastIndexOf('.') > 0) url = url.substring(0, url.lastIndexOf('.'));
    return url;
  };
}

let b: Browser;

export default class PuppeteerUtils {
  public static async openBrowser(context: IContext, headless: boolean = true) {
    if (!b) {
      b = await puppeteer.launch({
        executablePath: path.resolve('chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
        headless: headless,
        slowMo: !headless ? 10 : 100,
        userDataDir: path.resolve('chrome-mac', 'runtime'),
        ignoreHTTPSErrors: true,
        args: [
          context.proxy ? `--proxy-server=${context.proxy}` : '',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certifcate-errors',
          '--ignore-certifcate-errors-spki-list',
          `--user-agent=${defaultUserAgent}`,
        ],
      });
    }
    //
    return b;
  }
  public static async closeBrowser() {
    if (!b) return;
    //
    await b.close();
    b = undefined;
    return true;
  }
  public static async openPage() {
    if (!b) return;
    //
    let page = await b.newPage();
    page.setDefaultNavigationTimeout(1 * 60 * 1000);
    return page;
  }
  public static async closePage(page: Page) {
    if (!page.isClosed()) await page.close();
  }
}
