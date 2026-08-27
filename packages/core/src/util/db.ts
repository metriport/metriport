import { MetriportError } from "@metriport/shared";

export const identifierRegex = new RegExp("^[a-zA-Z_][a-zA-Z0-9_]*$");
export const passwordRegex = new RegExp("^[a-zA-Z0-9_@#$%^&*()_+=\\-.,]{8,}$");

export function validateIdentifier(identifier: string, propName = "identifier"): void {
  if (!identifierRegex.test(identifier)) {
    throw new MetriportError(`Invalid ${propName}`, undefined, { [propName]: identifier });
  }
}

export function validatePassword(password: string): void {
  if (!password || !passwordRegex.test(password)) {
    throw new MetriportError(`Invalid password`);
  }
}
