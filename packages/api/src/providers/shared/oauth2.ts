import axios, { AxiosResponse } from "axios";
import stringify from "json-stringify-safe";
import { AuthorizationCode, Token } from "simple-oauth2";
import { z } from "zod";
import { getProviderTokenFromConnectedUserOrFail } from "../../command/connected-user/get-connected-user";
import { updateProviderData } from "../../command/connected-user/save-connected-user";
import MetriportError from "../../errors/metriport-error";
import { ConnectedUser } from "../../models/connected-user";
import { Config } from "../../shared/config";
import { ProviderOAuth2Options } from "../../shared/constants";

export const oauthUserTokenResponse = z.object({
  oauth_token: z.string(),
  oauth_token_secret: z.string(),
});

export interface OAuth2 {
  getAuthUri(state: string): Promise<string>;
  revokeProviderAccess(connectedUser: ConnectedUser): Promise<void>;
  getTokenFromAuthCode(code: string): Promise<string>;
  postAuth?(token: string, user?: ConnectedUser, internal?: boolean): Promise<void>;
  getAccessToken(connectedUser: ConnectedUser): Promise<string>;
}

export interface UriParams {
  scope?: string[] | string;
  redirect_uri: string;
  state: string;
  access_type?: string;
  prompt?: string;
}

export interface AuthCodeUriParams {
  scope?: string[] | string;
  redirect_uri: string;
  code: string;
  access_type?: string;
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

    if (this.providerName === "google") {
      uriParams.access_type = "offline";
      uriParams.prompt = "consent";
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

        // When the access token is refreshed it doesnt return a refresh token
        // It only creates one when creating authurl
        if (this.providerName === "google") {
          const oldToken = JSON.parse(token);
          const extensibleToken = JSON.parse(JSON.stringify(accessToken));
          extensibleToken.refresh_token = oldToken.refresh_token;
          accessToken.token = extensibleToken;
        }

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
        const msg = `Error refreshing access token`;
        console.log(`${msg}: ${String(error)}`);
        throw new MetriportError(msg, error, {
          connectedUserId: connectedUser.id,
        });
      }
    }

    return accessToken.token;
  }

  async getAccessToken(connectedUser: ConnectedUser): Promise<string> {
    const token = getProviderTokenFromConnectedUserOrFail(connectedUser, this.providerName);

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
    await updateProviderData({
      id: connectedUser.id,
      cxId: connectedUser.cxId,
      provider: this.providerName,
      providerItem: undefined,
    });

    return getProviderTokenFromConnectedUserOrFail(connectedUser, this.providerName);
  }

  async fetchProviderData<T>(
    endpoint: string,
    access_token: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callBack: (response: AxiosResponse<any, any>) => Promise<T>,
    params?: { [k: string]: string | number },
    extraHeaders?: { [l: string]: string }
  ): Promise<T> {
    try {
      const headers = {
        Authorization: `Bearer ${access_token}`,
        ...(extraHeaders && extraHeaders),
      };

      const resp = await axios.get(endpoint, {
        headers,
        params,
      });
      return await callBack(resp);
    } catch (error) {
      const msg = `Failed to fetch provider data`;
      console.log(`${msg}: ${String(error)}`);
      throw new MetriportError(msg, error, {
        endpoint,
        ...(params ? { params: stringify(params) } : {}),
        ...(extraHeaders ? { extraHeaders: stringify(extraHeaders) } : {}),
      });
    }
  }
}
