import { ConnectedUser } from "../../models/connected-user";
import { RawParams } from "../../shared/raw-params";

export interface NoAuth {
  revokeProviderAccess(connectedUser: ConnectedUser, rawParams?: RawParams): Promise<void>;
}
