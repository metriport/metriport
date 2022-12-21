import { v4 as uuidv4 } from "uuid";
import { ConnectedUser } from "../../models/connected-user";

export const createConnectedUser = async ({
  cxId,
  cxUserId,
}: {
  cxId: string;
  cxUserId: string;
}): Promise<ConnectedUser> => {
  const connUser = await ConnectedUser.create({
    id: uuidv4(),
    cxId,
    cxUserId,
  });
  return connUser;
};
