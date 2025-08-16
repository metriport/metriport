import { CommonWellManagementAPI, Member } from "./api";

export class CommonWellManagementAPIMock implements CommonWellManagementAPI {
  private readonly baseUrl: string;

  constructor(params: { baseUrl: string }) {
    this.baseUrl = params.baseUrl.endsWith("/") ? params.baseUrl.slice(0, -1) : params.baseUrl;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async getMember(): Promise<Member | undefined> {
    console.log(`[CommonWellManagementAPIMock] Would be calling CW's GET member endpoint now...`);
    return undefined;
  }

  public async getIncludeList(): Promise<string[]> {
    console.log(
      `[CommonWellManagementAPIMock] Would be calling CW's GET include list endpoint now...`
    );
    return [];
  }

  public async updateIncludeList(): Promise<void> {
    console.log(
      `[CommonWellManagementAPIMock] Would be calling CW's POST include list endpoint now...`
    );
  }
}
