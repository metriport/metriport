import { UserToken, UserTokenCreate } from "../../domain/user-token";
import { saveUserToken } from "./save-user-token";

export const createUserToken = async (userTokenCreate: UserTokenCreate): Promise<UserToken> => {
  const userToken = UserToken.create(userTokenCreate);
  return saveUserToken(userToken);
};
