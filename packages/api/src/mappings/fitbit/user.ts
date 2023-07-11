import { User } from "@metriport/api-sdk";

import { PROVIDER_FITBIT } from "../../shared/constants";
import { FitbitUser } from "./models/user";
import { Util } from "../../shared/util";

export const mapToUser = (fitbitUser: FitbitUser, date: string): User => {
  const metadata = {
    date: date,
    source: PROVIDER_FITBIT,
  };
  const user: User = {
    metadata: metadata,
    ...Util.addDataToObject("age", fitbitUser.user.age),
    ...Util.addDataToObject("first_name", fitbitUser.user.firstName),
    ...Util.addDataToObject("last_name", fitbitUser.user.lastName),
    ...Util.addDataToObject("city", fitbitUser.user.city),
    ...Util.addDataToObject("country", fitbitUser.user.country),
    ...Util.addDataToObject("date_of_birth", fitbitUser.user.dateOfBirth),
    ...Util.addDataToObject("gender", fitbitUser.user.gender),
  };

  return user;
};
