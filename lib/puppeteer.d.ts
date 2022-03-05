import puppeteer, { Page } from 'puppeteer-core';
import IContext from './context';
export declare const defaultUserAgent: string;
export declare function e_commutils(): void;
export default class PuppeteerUtils {
    static openBrowser(context: IContext, headless?: boolean): Promise<puppeteer.Browser>;
    static closeBrowser(): Promise<boolean>;
    static openPage(): Promise<puppeteer.Page>;
    static closePage(page: Page): Promise<void>;
}
