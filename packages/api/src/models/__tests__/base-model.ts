import { randUuid } from "@ngneat/falso";

export const makeBaseModel = ({ id }: { id?: string } = {}) => {
  return {
    id: id ?? randUuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    eTag: randUuid(),
  };
};
