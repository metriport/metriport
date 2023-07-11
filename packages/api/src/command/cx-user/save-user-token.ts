import { docTableNames, getDB } from "../../models/db";
import { UserToken } from "../../domain/user-token";

export type SaveUserTokenCommand = UserToken;

export const saveUserToken = async (userToken: SaveUserTokenCommand): Promise<UserToken> => {
  await getDB()
    .doc?.put({
      TableName: docTableNames.token,
      Item: userToken,
    })
    .promise();
  return userToken;
};
