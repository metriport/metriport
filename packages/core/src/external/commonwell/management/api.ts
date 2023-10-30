import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  Cookie,
  cookieFromString,
  CookieManager,
  cookiesToString,
} from "../../../domain/auth/cookie-management/cookie-manager";
import { MetriportError } from "../../../util/error/metriport-error";
import { safeStringify } from "../../../util/string";

dayjs.extend(duration);

const DEFAULT_TIMEOUT_GET_MEMBER = dayjs.duration({ seconds: 20 });
const DEFAULT_TIMEOUT_INCLUDE_LIST = dayjs.duration({ seconds: 30 });

const baseHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

export type Member = {
  id: string;
  name: string;
};

export class CommonWellManagementAPI {
  private readonly cookieManager: CookieManager;
  private readonly baseUrl: string;

  constructor(params: { cookieManager: CookieManager; baseUrl: string }) {
    this.cookieManager = params.cookieManager;
    this.baseUrl = params.baseUrl.endsWith("/") ? params.baseUrl.slice(0, -1) : params.baseUrl;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async getMember({
    timeout = DEFAULT_TIMEOUT_GET_MEMBER.asMilliseconds(),
    log = console.log,
  }: {
    timeout?: number;
    log?: typeof console.log;
  } = {}): Promise<Member | undefined> {
    const cookies = await this.cookieManager.getCookies();

    const resp = await axios.get(`${this.baseUrl}/Organization/GetMembers`, {
      timeout,
      withCredentials: true,
      headers: {
        ...baseHeaders,
        Cookie: cookiesToString(cookies),
        Origin: `${this.baseUrl}`,
        Referer: `${this.baseUrl}/Organization/List`,
      },
    });
    log(`Responded w/ ${resp.status} - ${resp.statusText}`);
    if (Array.isArray(resp.data) && resp.data.length > 0) {
      const member = resp.data[0];
      log(`Member: ${JSON.stringify(member)}`);
      return { id: member.Id, name: member.Name };
    }
    return undefined;
  }

  public async updateIncludeList({
    oid,
    careQualityOrgIds,
    timeout = DEFAULT_TIMEOUT_INCLUDE_LIST.asMilliseconds(),
    log = console.log,
  }: {
    oid: string;
    careQualityOrgIds: string[];
    timeout?: number;
    log?: typeof console.log;
  }): Promise<void> {
    const cookies = await this.cookieManager.getCookies();

    log(`Posting to /IncludeList...`);
    const resp = await axios.post(
      `${this.baseUrl}/Organization/${oid}/IncludeList`,
      {
        LocalOrganizationid: oid,
        IncludedOrganizationIdList: careQualityOrgIds,
      },
      {
        timeout,
        withCredentials: true,
        headers: {
          Cookie: cookiesToString(cookies),
          ...baseHeaders,
          Origin: `${this.baseUrl}`,
          Referer: `${this.baseUrl}/Organization/${oid}/IncludeList/Edit`,
        },
      }
    );
    log(`Responded w/ ${resp.status} - ${resp.statusText}`);
    const result = resp.data["SelectedOrganizationList"];
    if (!result) {
      const msg = `Bad response from CommonWell`;
      const additionalData = {
        status: resp.status,
        statusText: resp.statusText,
        data: safeStringify(resp.data),
      };
      log(msg, additionalData);
      throw new MetriportError(msg, undefined, additionalData);
    }
    log(
      "Response",
      JSON.stringify(
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.map((item: any) => ({
          Id: item.Id,
          Name: item.Name,
          AllSelected: item.AllSelected,
          //eslint-disable-next-line @typescript-eslint/no-explicit-any
          Organizations: item.Organizations?.map((o: any) => o.Id).join(", "),
        }))
      )
    );

    // see if the cookies were updated
    const respCookies = resp.headers["set-cookie"];
    if (respCookies) {
      log(`Received cookies, added/updated: ${respCookies.join("; ")}`);
      await this.updateCookies(cookies, respCookies);
    }
  }

  private async updateCookies(actualCookies: Cookie[], newCookies: string[]) {
    const newCookiesParsed = newCookies.flatMap(c => cookieFromString(c) ?? []);
    for (const newCookie of newCookiesParsed) {
      const existingCookieIndex = actualCookies.findIndex(c => c.name.startsWith(newCookie.name));
      if (existingCookieIndex >= 0) {
        actualCookies[existingCookieIndex] = newCookie;
      } else {
        actualCookies.push(newCookie);
      }
    }

    await this.cookieManager.updateCookies(actualCookies);
  }
}
