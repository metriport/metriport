import { faker } from "@faker-js/faker";

export function getOrMakeNumber(value: number | undefined): number {
  return value != undefined ? value : faker.number.int();
}
