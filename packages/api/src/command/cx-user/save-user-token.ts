import { docTableNames, getDB } from "../../models/db";
import { UserToken } from "../../domain/user-token";
import UnauthorizedError from "../../errors/unauthorized";

export type SaveUserTokenCommand = UserToken;

export const saveUserToken = async (userToken: SaveUserTokenCommand): Promise<UserToken> => {
  if (!docTableNames) throw new UnauthorizedError();
  await getDB()
    .doc?.put({
      TableName: docTableNames.token,
      Item: userToken,
    })
    .promise();
  return userToken;
};
