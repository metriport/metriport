import axios, { AxiosResponse } from "axios";
import { AuthorizationCode, Token } from "simple-oauth2";
import { z } from "zod";
import { updateProviderData } from "../command/connected-user/save-connected-user";
import { ConnectedUser } from "../models/connected-user";
import { Config } from "../shared/config";
import { ProviderOAuth2Options } from "../shared/constants";
import { getProviderDataFromConnectUserOrFail } from "../command/connected-user/get-connected-user";

export const oauthUserTokenResponse = z.object({
  oauth_token: z.string(),
  oauth_token_secret: z.string(),
});

export interface OAuth2 {
  getAuthUri(state: string): Promise<string>;
  revokeProviderAccess(connectedUser: ConnectedUser): Promise<void>;
  getTokenFromAuthCode(code: string): Promise<string>;
}

export interface UriParams {
  scope?: string[] | string;
  redirect_uri: string;
  state: string;
}

export interface AuthCodeUriParams {
  scope?: string[] | string;
  redirect_uri: string;
  code: string;
}

export class OAuth2DefaultImpl implements OAuth2 {
  constructor(
    private readonly providerName: ProviderOAuth2Options,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly oAuthConfig: {
      readonly tokenHost: string;
      readonly authorizeHost?: string;
      readonly authorizePath?: string;
      readonly tokenPath?: string;
      readonly revokePath?: string;
    },
    private readonly scopes?: string[] | string,
    private readonly clientOptions?: {
      readonly authorizationMethod?: "body" | "header";
    }
  ) {}

  getRedirectUri(): string {
    return `${Config.getConnectRedirectUrl()}/${this.providerName}`;
  }

  makeClient(): AuthorizationCode {
    return new AuthorizationCode({
      client: {
        id: this.clientId,
        secret: this.clientSecret,
        secretParamName: "client_secret",
        idParamName: "client_id",
      },
      auth: this.oAuthConfig,
      options: this.clientOptions,
    });
  }
  async getTokenFromAuthCode(code: string): Promise<string> {
    const client = this.makeClient();
    const params: AuthCodeUriParams = {
      code: code,
      redirect_uri: this.getRedirectUri(),
    };
    if (this.scopes) {
      params.scope = this.scopes;
    }
    const accessToken = await client.getToken(params);

    return JSON.stringify(accessToken);
  }

  async getAuthUri(state: string): Promise<string> {
    const client = this.makeClient();

    const uriParams: UriParams = {
      redirect_uri: this.getRedirectUri(),
      state: state,
    };

    if (this.scopes) {
      uriParams.scope = this.scopes;
    }

    const authorizationUri = client.authorizeURL(uriParams);
    return authorizationUri;
  }

  private async checkRefreshToken(token: string, connectedUser: ConnectedUser): Promise<Token> {
    const client = this.makeClient();
    let accessToken = client.createToken(JSON.parse(token));

    if (accessToken.expired()) {
      try {
        accessToken = await accessToken.refresh();

        const providerItem = connectedUser.providerMap
          ? {
              ...connectedUser.providerMap[this.providerName],
              token: JSON.stringify(accessToken.token),
            }
          : { token: JSON.stringify(accessToken.token) };
        await updateProviderData({
          id: connectedUser.id,
          cxId: connectedUser.cxId,
          provider: this.providerName,
          providerItem,
        });

        return accessToken.token;
      } catch (error) {
        console.log("Error refreshing access token: ", error);
        throw new Error("Error refreshing access token: ");
      }
    }

    return accessToken.token;
  }

  async getAccessToken(connectedUser: ConnectedUser): Promise<string> {
    const providerData = getProviderDataFromConnectUserOrFail(connectedUser, this.providerName);

    const token = providerData.token;

    const refreshedToken = await this.checkRefreshToken(token, connectedUser);

    return refreshedToken.access_token;
  }

  async revokeProviderAccess(connectedUser: ConnectedUser): Promise<void> {
    const providerToken = await this.revokeLocal(connectedUser);

    const client = this.makeClient();
    const token = JSON.parse(providerToken);
    const accessToken = client.createToken(token);

    await accessToken.revoke("access_token");
  }

  async revokeLocal(connectedUser: ConnectedUser): Promise<string> {
    const providerData = getProviderDataFromConnectUserOrFail(connectedUser, this.providerName);

    await updateProviderData({
      id: connectedUser.id,
      cxId: connectedUser.cxId,
      provider: this.providerName,
      providerItem: undefined,
    });

    return providerData.token;
  }

  async fetchProviderData<T>(
    connectedUser: ConnectedUser,
    endpoint: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callBack: (response: AxiosResponse<any, any>) => Promise<T>,
    params?: { [k: string]: string | number }
  ): Promise<T> {
    try {
      const access_token = await this.getAccessToken(connectedUser);

      const resp = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        params,
      });
      return await callBack(resp);
    } catch (error) {
      console.error(error);

      throw new Error(`Request failed ${endpoint}`);
    }
  }
}
