import assert from "assert";
import { Browser, BrowserContext, devices, firefox, Page } from "playwright";
import { CodeChallenge } from "../../../domain/code-challenge";
import { Cookie, CookieManager, cookiesToString } from "../../../domain/cookie-manager";
import { sleep } from "../../../util/sleep";
import { CommonWellManagementAPI } from "./api";

// This file relies heavily on Playwright: https://playwright.dev/docs/library

const cookiesToUse = [
  "MP_RQ_COOKIE",
  ".AspNet.Cookies",
  "__RequestVerificationToken",
  "SessionTimeoutRedirect",
  "MPUserTimeZoneOffset",
];

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
  /**
   * Indicates whether to run the browser in headless mode.
   */
  headless?: boolean;
  debug?: typeof console.log;
};

export class SessionManagement {
  private readonly cookieManager: CookieManager;
  private readonly cwManagementApi: CommonWellManagementAPI;
  private readonly codeChallenge: CodeChallenge;
  private readonly headless: boolean;
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private sessionBaseUrl: string;
  private username: string;
  private password: string;
  private debug: typeof console.log;

  constructor(params: SessionManagementConfig) {
    this.cookieManager = params.cookieManager;
    this.cwManagementApi = params.cwManagementApi;
    this.codeChallenge = params.codeChallenge;
    this.headless = params.headless == undefined ? true : params.headless;
    this.sessionBaseUrl = this.cwManagementApi.getBaseUrl();
    this.username = params.username;
    this.password = params.password;
    this.debug = params.debug ?? (() => {}); //eslint-disable-line @typescript-eslint/no-empty-function
  }

  async keepSessionActive(): Promise<void> {
    const log = console.log;
    try {
      const isSessionValid = (await this.cwManagementApi.getMember()) != undefined;

      if (isSessionValid) {
        log(`Session is still valid, returning...`);
        return;
      }

      log(`Session is invalid, generating new cookies...`);
      const page = await this.login();

      const cookies = await page.context().cookies();
      const filteresCookies = cookies.filter(this.isEnabledCookie);
      this.debug(`-----> cookiesString: ${cookiesToString(filteresCookies)}`);

      log(`Got cookies, updating DynamoDB...`);
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
    if (!this.browser || !this.browser.isConnected() || !this.context) {
      this.browser = await firefox.launch({ headless: this.headless, slowMo: 50 });
      this.context = await this.browser.newContext(devices["Desktop Firefox HiDPI"]);
    }
    const page = await this.context.newPage();

    try {
      log(`.1`);
      await page.goto(this.sessionBaseUrl);
      log(`.2`);
      assert(await page.getByRole("link", { name: "Healthcare ID" }).isEnabled());
      await page.getByRole("link", { name: "Healthcare ID" }).click();
      log(`.3`);
      assert(await page.getByTestId("username").isEditable());
      await page.getByTestId("username").click();
      await page.getByTestId("username").fill(this.username);
      log(`.5`);
      assert(await page.getByTestId("login-pwd").isEditable());
      await page.getByTestId("login-pwd").click();
      await page.getByTestId("login-pwd").fill(this.password);
      log(`.7`);
      assert(await page.getByRole("button", { name: "Continue" }).isEnabled());
      await page.getByRole("button", { name: "Continue" }).click();
      log(`.8`);

      log(`Waiting to see if the code challenge will be requested...`);
      log(`URL pre sleep: ${page.url()}`);
      // await page.screenshot({ path: "screenshot-pre.png" });
      await sleep(2_000);
      // It should be: https://identity.onehealthcareid.com/oneapp/index.html#/rba/options/email
      log(`URL post sleep: ${page.url()}`);
      // await page.screenshot({ path: "screenshot-post.png" });
      log(`.9`);

      const isAccessCodePage = await page.getByRole("heading", { name: "Access Code" }).isVisible();
      if (isAccessCodePage) {
        log("---> Code challenge requested");
        const accessCode = await this.codeChallenge.getCode();
        log(`.A`);

        assert(await page.getByTestId("accessCodeBox").isEnabled());
        await page.getByTestId("accessCodeBox").click();
        await page.getByTestId("accessCodeBox").fill(accessCode);
        log(`.B`);

        const skipCheckbox = page.getByRole("checkbox", {
          name: "Skip this step in future if this is your private device.",
        });
        assert(await skipCheckbox.isEnabled());
        await skipCheckbox.click();
        log(`.C`);

        assert(await page.getByRole("button", { name: "Continue" }).isEnabled());
        await page.getByRole("button", { name: "Continue" }).click();
        log(`.D`);
      } else {
        log("---> It did not ask for code challenge.");
      }
      log(`.10`);

      assert(await page.locator("#OrganizationsBtn").isEnabled());
      await page.locator("#OrganizationsBtn").click();
      log(`.11`);

      assert(await page.locator("#ListOrganizationsBtn").isEnabled());
      await page.locator("#ListOrganizationsBtn").click();
      log(`.12`);

      assert(await page.getByRole("heading", { name: "Organization List" }).isVisible());
      await page.getByRole("heading", { name: "Organization List" }).click();
      log(`.13`);

      return page;
    } catch (error) {
      await page.screenshot({ path: "screenshot-error.png" });
      throw error;
    }
  }

  protected async logout(): Promise<void> {
    const log = this.debug;
    log(`Closing the browser if it was opened...`);
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  protected isEnabledCookie(c: Cookie) {
    for (const cookie of cookiesToUse) {
      if (cookie.toLowerCase().startsWith(c.name.toLowerCase())) return true;
    }
    return false;
  }
}
