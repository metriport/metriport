import { faker } from "@faker-js/faker";

interface OidRange {
  min: number;
  max: number;
}

interface MakeOidOptions {
  amountOfLevels?: number;
  startFrom?: string;
  range?: OidRange;
}

/**
 * Generates a valid OID (Object Identifier) string
 * @param options - Optional parameters to customize the OID generation
 * @param options.amountOfLevels - Number of levels the OID should have (default: 6)
 * @param options.startFrom - Base OID to start from (default: "1.2.840")
 * @param options.range - Range for each OID component (default: { min: 1, max: 999999 })
 * @returns A valid OID string
 */
export function makeOid(options: MakeOidOptions = {}): string {
  const { amountOfLevels = 6, startFrom = "1.2.3", range = { min: 1, max: 999999 } } = options;

  const existingLevels = startFrom.split(".").map(Number);

  if (existingLevels.length > amountOfLevels) {
    throw new Error(
      `startFrom OID has ${existingLevels.length} levels, but amountOfLevels is ${amountOfLevels}`
    );
  }

  const levelsNeeded = amountOfLevels - existingLevels.length;
  const additionalLevels: number[] = [];

  for (let i = 0; i < levelsNeeded; i++) {
    const randomLevel = faker.number.int({ min: range.min, max: range.max });
    additionalLevels.push(randomLevel);
  }

  const allLevels = [...existingLevels, ...additionalLevels];

  const finalLevels = allLevels.slice(0, amountOfLevels);

  return finalLevels.join(".");
}
