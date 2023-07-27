import { randUuid } from "@ngneat/falso";
import { BaseDomain } from "../base-domain";

export const makeBaseDomain = ({ id }: { id?: string } = {}): BaseDomain => {
  return {
    id: id ?? randUuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    eTag: randUuid(),
  };
};
