import { faker } from "@faker-js/faker";
import { uuidv7 } from "../../util/uuid-v7";
import { BaseDomain } from "../base-domain";

export const makeBaseDomain = ({ id }: { id?: string } = {}): BaseDomain => {
  return {
    id: id ?? uuidv7(),
    createdAt: new Date(),
    updatedAt: new Date(),
    eTag: faker.string.uuid(),
  };
};
