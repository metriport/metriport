import { faker } from "@faker-js/faker";
import { Settings } from "../settings";
import { makeBaseDomain } from "./base-domain";

export const makeSetting = ({ id }: { id: string }): Settings => {
  return {
    ...makeBaseDomain({ id }),
    webhookUrl: faker.internet.url(),
    webhookKey: faker.string.uuid(),
    webhookEnabled: faker.datatype.boolean(),
    webhookStatusDetail: faker.string.uuid(),
  };
};
