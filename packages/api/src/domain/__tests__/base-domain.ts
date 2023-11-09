import { faker } from "@faker-js/faker";
import { BaseDomain } from "../base-domain";

export const makeBaseDomain = ({ id }: { id?: string } = {}): BaseDomain => {
  return {
    id: id ?? faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    eTag: faker.string.uuid(),
  };
};
