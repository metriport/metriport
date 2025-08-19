/* eslint-disable @typescript-eslint/no-empty-function */
import { Browser, Page } from "playwright";
import { CodeChallenge } from "../../../domain/auth/code-challenge";
import {
  Cookie,
  CookieManager,
  cookiesToString,
} from "../../../domain/auth/cookie-management/cookie-manager";
import { MetriportError } from "../../../util/error/metriport-error";
import { sleep } from "../../../util/sleep";
import { CommonWellManagementAPI } from "./api";
import { userAgent } from "./api-impl";

// This file relies heavily on Playwright: https://playwright.dev/docs/library

// TODO to duration
const timeBetweenSteps = 1_000;

const cookiesToUse = [
  "MP_RQ_COOKIE",
  ".AspNet.Cookies",
  "__RequestVerificationToken",
  "SessionTimeoutRedirect",
  "MPUserTimeZoneOffset",
];
const logDenyList = [
  ".png",
  ".jpg",
  "css",
  ".js",
  ".woff",
  ".woff2",
  ".ttf",
  ".svg",
  "jquery",
  "bootstrap",
  "angular",
  "modernizr",
  "theme",
  "htm",
];

// TODO move this to the api.ts
const apiEndpoints = ["api", "authenticate", "verifyotp", "getmembers"];

const htmlRequestHeaders = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "Content-Type": "application/x-www-form-urlencoded",
};
const apiRequestHeaders = {
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Content-Type": "application/json",
};

export type Screenshot = (screenshotAsB64: string, title: string) => Promise<void>;

/**
 * Manages the session on the CommonWell management portal.
 */
export type SessionManagementConfig = {
  username: string;
  password: string;
  cookieManager: CookieManager;
  cwManagementApi: CommonWellManagementAPI;
  /**
   * The service to obtain a code to pass the login code challenge, if needed.
   */
  codeChallenge: CodeChallenge;
  browser: Browser;
  /**
   * Whether to save a screenshot to the file system when an error happens.
   * If `true`, it will save the screenshot to the file system, current folder.
   * If `false`, it will include the screenshot as base64 on the error object.
   * Defaults to `false`.
   */
  errorScreenshotToFileSystem?: boolean;
  /**
   * The function to use to log debug messages.
   */
  debug?: typeof console.log;
  screenshot?: Screenshot;
};

export class SessionManagement {
  private readonly cookieManager: CookieManager;
  private readonly cwManagementApi: CommonWellManagementAPI;
  private readonly codeChallenge: CodeChallenge;
  private browser: Browser;
  private sessionBaseUrl: string;
  private username: string;
  private password: string;
  private errorToFS: boolean;
  private debug: typeof console.log;
  private screenshot: Screenshot;

  static exceptionScreenshotKey = "screenshotAsB64";

  constructor(params: SessionManagementConfig) {
    this.cookieManager = params.cookieManager;
    this.cwManagementApi = params.cwManagementApi;
    this.codeChallenge = params.codeChallenge;
    this.browser = params.browser;
    this.sessionBaseUrl = this.cwManagementApi.getBaseUrl();
    this.username = params.username;
    this.password = params.password;
    this.errorToFS =
      params.errorScreenshotToFileSystem == undefined ? false : params.errorScreenshotToFileSystem;
    this.debug = params.debug ?? (() => {}); //eslint-disable-line @typescript-eslint/no-empty-function
    this.screenshot = params.screenshot ?? (async () => {});
  }

  async initSession(): Promise<void> {
    return this.keepSessionActive();
  }

  async keepSessionActive(): Promise<void> {
    const log = console.log;
    try {
      const member = await this.cwManagementApi.getMember();

      const isSessionValid = member != undefined;
      if (isSessionValid) {
        log(`Session is still valid, returning...`);
        return;
      }

      log(`Session is invalid, generating new cookies...`);
      const page = await this.login();

      const cookies = await page.context().cookies();
      const filteresCookies = cookies.filter(this.isEnabledCookie);
      this.debug(`-----> cookiesString: ${cookiesToString(filteresCookies)}`);

      log(`Got cookies, updating store...`);
      await this.cookieManager.updateCookies(filteresCookies);

      log(`Done.`);
    } finally {
      await this.logout();
    }
  }

  /**
   * Logs in on the CommonWell management portal.
   *
   * @returns the Playwright Page object pointing to CW's management portal Organization List page.
   */
  protected async login(): Promise<Page> {
    const log = this.debug;
    if (!this.browser) throw new Error(`Browser is not defined`);
    if (!this.browser.isConnected()) throw new Error(`Browser is not conneceted`);

    const page = await this.browser.newPage({
      acceptDownloads: false,
      userAgent,
    });
    try {
      // Log information about the requests
      await page.route("**", (route, request) => {
        if (logDenyList.some(d => request.url().includes(d))) {
          route.continue();
          return;
        }
        if (apiEndpoints.some(e => request.url().includes(e))) {
          page.setExtraHTTPHeaders(apiRequestHeaders);
        } else {
          page.setExtraHTTPHeaders(htmlRequestHeaders);
        }
        request.response().then(async resp => {
          const responseString = resp ? ` - status: ${resp.status()}, ${resp.statusText()}` : "";
          log(request.url() + responseString);
          if (request.url().includes("/authenticate") && resp) {
            const respBody = await resp.body();
            log(`${request.url()} - body: ${respBody.toString()}`);
          }
        });
        route.continue();
      });

      // TODO 1195 remove the excessive logs (".xx")
      log(`.1`);
      await page.goto(this.sessionBaseUrl);
      await sleep(timeBetweenSteps);
      this.screenshot((await page.screenshot()).toString("base64"), "choose-auth");
      log(`.2`);
      await page.getByRole("link", { name: "Healthcare ID" }).click();
      await sleep(timeBetweenSteps);
      this.screenshot((await page.screenshot()).toString("base64"), "auth-home");
      log(`.3`);
      const usernameLocator = () => page.getByTestId("username");
      await usernameLocator().click({ timeout: 10_000 });
      await usernameLocator().fill(this.username);
      log(`.5`);
      const loginLocator = () => page.getByTestId("login-pwd");
      await loginLocator().click();
      await loginLocator().fill(this.password);
      log(`.7`);
      await page.getByRole("button", { name: "Continue" }).click();
      log(`.8`);

      log(`Waiting to see if the code challenge will be requested...`);
      log(`URL pre sleep: ${page.url()}`);

      // Take some time so the code challenge can be requested, if needed.
      await sleep(2_000);
      // It should be: https://identity.onehealthcareid.com/oneapp/index.html#/rba/options/email
      log(`URL post sleep: ${page.url()}`);
      await sleep(timeBetweenSteps);
      this.screenshot((await page.screenshot()).toString("base64"), "post-creds");
      log(`.9`);

      const isAccessCodePage = await page.getByRole("heading", { name: "Access Code" }).isVisible();
      if (isAccessCodePage) {
        log("---> Code challenge requested");
        const accessCode = await this.codeChallenge.getCode();
        log(`.A`);

        await page.getByTestId("accessCodeBox").click();
        await page.getByTestId("accessCodeBox").fill(accessCode);
        log(`.B`);

        const skipCheckbox = page.getByRole("checkbox", {
          name: "Skip this step in future if this is your private device.",
        });
        await skipCheckbox.click();
        await sleep(timeBetweenSteps);
        this.screenshot((await page.screenshot()).toString("base64"), "access-code");
        log(`.C`);

        await page.getByRole("button", { name: "Continue" }).click();
        log(`.D`);
      } else {
        const isLoginPageAgain = await usernameLocator().isVisible();
        if (isLoginPageAgain) {
          log(`---> It asked for the login again, browser error.`);
          // await sleep(20_000);
          throw new Error("Browser failed to login");
        }
        log("---> It did not ask for code challenge.");
      }
      log(`.10`);

      await page.locator("#OrganizationsBtn").click();
      await sleep(timeBetweenSteps);
      this.screenshot((await page.screenshot()).toString("base64"), "cw-home");
      log(`.11`);

      await page.locator("#ListOrganizationsBtn").click();
      await sleep(timeBetweenSteps);
      this.screenshot((await page.screenshot()).toString("base64"), "cw-list-orgs");
      log(`.12`);

      await page.getByRole("heading", { name: "Organization List" }).click();
      await sleep(timeBetweenSteps);
      this.screenshot((await page.screenshot()).toString("base64"), "cw-list-orgs2");
      log(`.13`);

      return page;
    } catch (error) {
      const msg = "Error while logging in";
      await sleep(500); // give some time for the (error) page to load
      if (this.errorToFS) {
        await page.screenshot({ path: "screenshot-error.png" });
        throw new MetriportError(msg, error);
      }
      const buffer = await page.screenshot();
      const screenshotAsB64 = buffer.toString("base64");
      throw new MetriportError(msg, error, {
        [SessionManagement.exceptionScreenshotKey]: screenshotAsB64,
      });
    }
  }

  protected async logout(): Promise<void> {
    const log = this.debug;
    log(`Closing the browser if it was opened...`);
    // TODO 1195 Move this outside this class, we get the browser connected and shouldn't disconnect it here.
    if (this.browser)
      try {
        await this.browser.close();
      } catch (err) {
        log(`Error while closing the browser, likely context was already closed.`);
      }
  }

  protected isEnabledCookie(c: Cookie) {
    for (const cookie of cookiesToUse) {
      if (cookie.toLowerCase().startsWith(c.name.toLowerCase())) return true;
    }
    return false;
  }
}
