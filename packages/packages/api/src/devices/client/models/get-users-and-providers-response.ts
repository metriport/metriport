import { UserIdsAndProviders } from "../../models/common/ids-and-providers";

export interface GetUsersAndProvidersResponse {
  connectedUsers: UserIdsAndProviders[];
}
