"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.e_commutils = exports.defaultUserAgent = void 0;
const path_1 = __importDefault(require("path"));
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
exports.defaultUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36';
function e_commutils() {
    this.trimLocalName = (localName, maxLength = 243) => {
        localName = localName
            .replace(/[\r\n]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/[\\\/:*?\"<>|]/g, ' ')
            .replace(/\.$/g, '')
            .replace(/…/, ' ')
            .trim();
        if (localName.length > maxLength)
            localName = localName.substring(0, maxLength);
        return localName;
    };
    this.localNameFromURL = (url) => {
        if (url.endsWith('/'))
            url = url.substring(0, url.length - 1);
        url = url.substring(url.lastIndexOf('/') + 1);
        if (url.indexOf('&') > 0)
            url = url.substring(0, url.indexOf('&'));
        if (url.lastIndexOf('.') > 0)
            url = url.substring(0, url.lastIndexOf('.'));
        return url;
    };
}
exports.e_commutils = e_commutils;
let b;
class PuppeteerUtils {
    static async openBrowser(context, headless = true) {
        if (!b) {
            b = await puppeteer_core_1.default.launch({
                executablePath: path_1.default.resolve('chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
                headless: headless,
                slowMo: !headless ? 10 : 100,
                userDataDir: path_1.default.resolve('chrome-mac', 'runtime'),
                ignoreHTTPSErrors: true,
                args: [
                    context.proxy ? `--proxy-server=${context.proxy}` : '',
                    '--disable-infobars',
                    '--window-position=0,0',
                    '--ignore-certifcate-errors',
                    '--ignore-certifcate-errors-spki-list',
                    `--user-agent=${exports.defaultUserAgent}`,
                ],
            });
        }
        return b;
    }
    static async closeBrowser() {
        if (!b)
            return;
        await b.close();
        b = undefined;
        return true;
    }
    static async openPage() {
        if (!b)
            return;
        let page = await b.newPage();
        page.setDefaultNavigationTimeout(1 * 60 * 1000);
        return page;
    }
    static async closePage(page) {
        if (!page.isClosed())
            await page.close();
    }
}
exports.default = PuppeteerUtils;
//# sourceMappingURL=puppeteer.js.map