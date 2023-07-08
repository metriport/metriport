import { User } from "@metriport/api-sdk";
import { PROVIDER_WHOOP } from "../../shared/constants";
import { WhoopUser } from "./models/user";

export const mapToUser = (whoopUser: WhoopUser, date: string): User => {
  return {
    metadata: {
      date: date,
      source: PROVIDER_WHOOP,
    },
    email: whoopUser.email,
    first_name: whoopUser.first_name,
    last_name: whoopUser.last_name,
  };
};
