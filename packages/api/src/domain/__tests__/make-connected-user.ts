import { ConnectedUser } from "../../models/connected-user";
import { v4 as uuidv4 } from "uuid";

export function makeConnectedUser(user: Partial<ConnectedUser>): Partial<ConnectedUser> {
  return {
    id: user.id ?? uuidv4(),
    cxId: user.cxId ?? uuidv4(),
    providerMap: user.providerMap ?? {},
  };
}
