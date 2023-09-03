import { faker } from "@faker-js/faker";

export type Customer = {
  id: string;
  subscriptionStatus: "disabled" | "active" | "overdue";
  stripeCxId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  website: string | null;
};

export type Account = { customer: Customer; idToken?: string; accessToken?: string };

export const testAccount = {
  email: faker.internet.email(),
  password: faker.internet.password(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  website: faker.internet.url(),
};
