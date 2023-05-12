import { randUuid } from "@ngneat/falso";

export const makeBaseModel = () => {
  return {
    id: randUuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    eTag: randUuid(),
  };
};
