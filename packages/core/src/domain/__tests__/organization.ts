import { faker } from "@faker-js/faker";

export const makeOrgNumber = () => faker.number.int({ min: 0, max: 1_000_000_000 });
