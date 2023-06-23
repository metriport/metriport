import { faker } from "@faker-js/faker";

export function makeOptionalNumber(value: number | null | undefined): number | undefined {
  return value === null ? undefined : value !== undefined ? value : faker.number.int();
}
