import {
  BadRequestError,
  errorToString,
  normalizeCity as normalizeCityFromShared,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  toTitleCase,
  USStateForAddress,
} from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { Address } from "../../../domain/address";
import { out } from "../../../util";
import { ParsingError } from "./shared";

const maxAddresses = 10;

/**
 * Maps a record/map of CSV patient data to a Metriport Address.
 *
 * NOTE: when parsing columns, csv-parser populates them in lower-case, so
 * the property names are all lower-case.
 *
 * @param csvPatient - The CSV patient data.
 * @returns The Metriport patient's addresses, with errors indicated on the errors array.
 */
export function mapCsvAddresses(csvPatient: Record<string, string>): {
  addresses: Address[];
  errors: ParsingError[];
} {
  const errors: ParsingError[] = [];
  const addresses: (Address | undefined)[] = [];

  const { address: addressNoIdx, errors: errorsNoIdx } = parseAddress(csvPatient, undefined);
  addresses.push(addressNoIdx);
  errors.push(...errorsNoIdx);

  for (let i = 1; i <= maxAddresses; i++) {
    const { address: addressIdx, errors: errorsIdx } = parseAddress(csvPatient, i);
    addresses.push(addressIdx);
    errors.push(...errorsIdx);
  }

  const filteredAddresses = addresses.flatMap(filterTruthy);
  if (filteredAddresses.length < 1) {
    errors.push({
      field: "address",
      error: `Patient has no address`,
    });
  }
  return { addresses: filteredAddresses, errors };
}

function parseAddress(
  csvPatient: Record<string, string>,
  index: number | undefined
): { address: Address | undefined; errors: ParsingError[] } {
  const { log } = out(`parseAddress`);
  const errors: ParsingError[] = [];
  const indexSuffix = index ? `-${index}` : "";

  const addressLine1Name = `addressLine1${indexSuffix}`;
  const addressLine1AlternativeName = `address1${indexSuffix}`;
  const addressLine2Name = `addressLine2${indexSuffix}`;
  const addressLine2AlternativeName = `address2${indexSuffix}`;
  const cityName = `city${indexSuffix}`;
  const stateName = `state${indexSuffix}`;
  const zipName = `zip${indexSuffix}`;

  let foundAtLeastOneProperty = false;
  let addressLine1: string | undefined = undefined;
  let addressLine2: string | undefined = undefined;
  try {
    const res = normalizeAddressLine(
      csvPatient[addressLine1Name] ??
        csvPatient[addressLine1Name.toLowerCase()] ??
        csvPatient[addressLine1AlternativeName],
      addressLine1Name,
      true
    );
    addressLine1 = res[0];
    addressLine2 = res[1];
    if (!addressLine1) throw new BadRequestError(`Missing ${addressLine1Name}`);
    foundAtLeastOneProperty = true;
  } catch (error) {
    errors.push({ field: addressLine1Name, error: errorToString(error) });
  }

  try {
    const dedicatedAddressLine2 = normalizeAddressLine(
      csvPatient[addressLine2Name] ??
        csvPatient[addressLine2Name.toLowerCase()] ??
        csvPatient[addressLine2AlternativeName],
      addressLine2Name
    );
    if (dedicatedAddressLine2) {
      if (addressLine2) {
        log(
          `Found ${addressLine2Name} on both its own field and as part of ${addressLine1Name} ` +
            `(from ${addressLine1Name}: ${addressLine2}), using the one from ${addressLine2Name}: ${dedicatedAddressLine2}`
        );
      }
      addressLine2 = dedicatedAddressLine2;
    }
    if (addressLine2) foundAtLeastOneProperty = true;
  } catch (error) {
    errors.push({ field: addressLine2Name, error: errorToString(error) });
  }

  let city: string | undefined = undefined;
  try {
    city = normalizeCity(csvPatient[cityName]);
    if (!city) throw new BadRequestError(`Missing ${cityName}`);
    foundAtLeastOneProperty = true;
  } catch (error) {
    errors.push({ field: cityName, error: errorToString(error) });
  }

  let state: USStateForAddress | undefined = undefined;
  try {
    state = normalizeUSStateForAddressSafe(csvPatient[stateName] ?? "");
    if (!state) throw new BadRequestError(`Missing ${stateName}`);
    foundAtLeastOneProperty = true;
  } catch (error) {
    errors.push({ field: stateName, error: errorToString(error) });
  }

  let zip: string | undefined = undefined;
  try {
    zip = normalizeZipCodeNewSafe(csvPatient[zipName] ?? "");
    if (!zip) throw new BadRequestError(`Missing ${zipName}`);
    foundAtLeastOneProperty = true;
  } catch (error) {
    errors.push({ field: zipName, error: errorToString(error) });
  }

  if (!addressLine1 || !city || !state || !zip) {
    if (foundAtLeastOneProperty) return { address: undefined, errors };
    return { address: undefined, errors: [] };
  }
  const address: Address = {
    addressLine1,
    ...(addressLine2 ? { addressLine2 } : {}),
    city,
    state,
    zip,
    country: "USA",
  };
  return { address, errors };
}

export function normalizeAddressLine(
  addressLine: string | undefined,
  propName: string,
  splitUnit: true
): string[];
export function normalizeAddressLine(
  addressLine: string | undefined,
  propName: string,
  splitUnit?: false | undefined
): string;
export function normalizeAddressLine(
  addressLine: string | undefined,
  propName: string,
  splitUnit = false
): string | string[] {
  if (addressLine == undefined) throw new BadRequestError(`Missing ` + propName);
  const withoutPunctuation = addressLine.replace(/[.,;]/g, " ");
  const withoutInstructions = withoutPunctuation.replace(/\(.*\)/g, " ");
  const normalized = toTitleCase(withoutInstructions);
  if (!splitUnit) return normalized;
  // Common street type variations in US addresses
  const match = (normalized + " ").match(addrUnitRegex);
  if (match && match.flatMap(filterTruthy).length > 3) {
    const [, mainAddressMatch, , unitMatch] = match;
    return processMatches(mainAddressMatch, unitMatch);
  }
  const matchExact = normalized.match(addrUnitExactRegex);
  if (matchExact && matchExact.flatMap(filterTruthy).length > 2) {
    const [, mainAddressMatch, unitMatch] = matchExact;
    return processMatches(mainAddressMatch, unitMatch);
  }
  return [normalized];
}

function processMatches(
  mainAddrMatch: string | undefined,
  unitMatch: string | undefined
): string[] {
  const mainAddress = mainAddrMatch ? mainAddrMatch.trim() : undefined;
  const unit = unitMatch ? unitMatch.trim() : undefined;
  return [mainAddress, unit].flatMap(filterTruthy);
}

export function normalizeCity(city: string | undefined): string | undefined {
  if (city == undefined) return undefined;
  const normalizedCity = normalizeCityFromShared(city);
  if (normalizedCity.length < 1) return undefined;
  return normalizedCity;
}

const streetTypes = [
  "street",
  "st",
  "road",
  "rd",
  "lane",
  "ln",
  "drive",
  "dr",
  "avenue",
  "ave",
  "boulevard",
  "blvd",
  "circle",
  "cir",
  "court",
  "ct",
  "place",
  "pl",
  "terrace",
  "ter",
  "trail",
  "trl",
  "way",
  "highway",
  "hwy",
  "parkway",
  "pkwy",
  "crossing",
  "xing",
  "square",
  "sq",
  "loop",
  "path",
  "pike",
  "alley",
  "run",
];

const unitIndicators = ["apt", "apartment", "unit", "suite", "ste", "#", "number", "floor", "trlr"];
const unitIndicatorsExact = unitIndicators.concat(["no", "fl", "lot", "rm", "room"]);
const addrUnitRegex = new RegExp(
  `(.*?\\W+(${streetTypes.join("|")})\\W+.*?)\\s*((${unitIndicators.join(
    "|"
  )})\\s*[#]?\\s*[\\w\\s-]+)?$`,
  "i"
);
const addrUnitExactRegex = new RegExp(
  `(.+?)\\s*((${unitIndicatorsExact.join("|")})((\\s*#\\s*[\\w\\s-]+)|(\\s*[\\d\\s-]+)))?$`,
  "i"
);
