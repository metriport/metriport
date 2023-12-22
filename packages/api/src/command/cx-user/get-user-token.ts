import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { UserToken } from "../../domain/user-token";
import NotFoundError from "../../errors/not-found";
import { docTableNames, getDB } from "../../models/db";
import { capture } from "@metriport/core/util/capture";

export type GetUserTokenCommand = {
  token: string;
};

export const getUserToken = async ({ token }: GetUserTokenCommand): Promise<UserToken> => {
  const item = await getDB()
    .doc?.get({
      TableName: docTableNames.token,
      Key: { token },
    })
    .promise();
  if (item && item.Item) {
    const token = ddbItemAsOAuth(item.Item);
    capture.setUser({ id: token.userId });
    return token;
  }
  // TODO protect the token on log, show only 5 first and last chars
  console.log(`Could not find token on DynamoDB: ${token}`);
  throw new NotFoundError(`Could not find token on DynamoDB`);
};

export type GetUserTokenByUATCommand = {
  oauthUserAccessToken: string;
};

export const getUserTokenByUAT = async ({
  oauthUserAccessToken,
}: GetUserTokenByUATCommand): Promise<UserToken[]> => {
  const items = await getDB()
    .doc?.query({
      TableName: docTableNames.token,
      IndexName: "oauthUserAccessToken_idx",
      KeyConditionExpression: "oauthUserAccessToken = :uat",
      ExpressionAttributeValues: {
        ":uat": oauthUserAccessToken,
      },
    })
    .promise();
  if (items && items.Items) {
    return items.Items.map(ddbItemAsOAuth);
  }
  return [];
};

const ddbItemAsOAuth = (item: DocumentClient.AttributeMap): UserToken => {
  const {
    token,
    cxId,
    userId,
    expiryTime,
    oauthRequestToken,
    oauthRequestSecret,
    oauthUserAccessToken,
    oauthUserAccessSecret,
  } = item;
  if (!token || !cxId || !userId || !expiryTime) {
    throw new Error(`Invalid user token entry on DB`);
  }
  return UserToken.build({
    token,
    cxId,
    userId,
    expiryTime,
    oauthRequestToken,
    oauthRequestSecret,
    oauthUserAccessToken,
    oauthUserAccessSecret,
  });
};
