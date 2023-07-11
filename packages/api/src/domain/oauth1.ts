// Move to the same pattern as UserToken
export type OAuth1Data = {
  userToken: string; // 'token' from table 'token' - Metriport generated for Connect Widget
  oauth_token: string;
  oauth_token_secret?: string;
  userAccessToken?: string;
  userAccessTokenSecret?: string;
};
