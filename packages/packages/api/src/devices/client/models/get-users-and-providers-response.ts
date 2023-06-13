export type UserIdsAndProviders = {
  metriportUserId: string;
  appUserId: string;
  connectedProviders?: string[];
};

export interface GetUsersAndProvidersResponse {
  connectedUsers: UserIdsAndProviders[];
}
