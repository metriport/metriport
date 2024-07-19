import { Contact } from "../demographics";
import { faker } from "@faker-js/faker";

export function makeContact(params: Partial<Contact> = {}): Contact {
  return {
    phone: params.phone ?? faker.phone.number("##########"),
    email: params.email ?? faker.internet.email(),
  };
}
