import {
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  toTitleCase,
  USStateForAddress,
} from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import { Address } from "../../../domain/address";
import { ParsingError } from "./shared";

const maxAddresses = 10;

export function mapCsvAddresses(csvPatient: Record<string, string>): {
  addresses: Address[];
  errors: ParsingError[];
} {
  const errors: ParsingError[] = [];
  const addresses: (Address | undefined)[] = [];

  const { address: addressNoIdx, errors: errorsNoIdx } = parseAddress(csvPatient, undefined);
  addresses.push(addressNoIdx);
  errors.push(...errorsNoIdx);

  for (let i = 1; i <= 10; i++) {
    const { address: addressIdx, errors: errorsIdx } = parseAddress(csvPatient, i);
    addresses.push(addressIdx);
    errors.push(...errorsIdx);
  }

  const filteredAddresses = addresses.flatMap(filterTruthy);
  if (filteredAddresses.length > maxAddresses) {
    errors.push({
      field: "address",
      error: `Found more than 10 addresses`,
    });
  }
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
  const errors: ParsingError[] = [];
  const indexSuffix = index ? `-${index}` : "";
  let foundProperty = false;

  let addressLine1: string | undefined = undefined;
  let addressLine2: string | undefined = undefined;
  try {
    const res = normalizeAddressLine(
      csvPatient[`addressline1${indexSuffix}`] ?? csvPatient[`address1${indexSuffix}`],
      `addressLine1${indexSuffix}`,
      true
    );
    addressLine1 = res[0];
    addressLine2 = res[1];
    if (!addressLine1) throw new Error(`Missing addressLine1${indexSuffix}`);
    foundProperty = true;
  } catch (error) {
    errors.push({
      field: `addressLine1${indexSuffix}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const dedicatedAddressLine2 = normalizeAddressLine(
      csvPatient[`addressline2${indexSuffix}`] ?? csvPatient[`address2${indexSuffix}`],
      `addressLine2${indexSuffix}`
    );
    if (addressLine2 && dedicatedAddressLine2) {
      throw new Error(
        `Found addressLine2${indexSuffix} on both its own field and as part of addressLine1${indexSuffix} ` +
          `(from addressLine1${indexSuffix}: ${addressLine2})`
      );
    }
    if (!addressLine2) addressLine2 = dedicatedAddressLine2;
    if (addressLine2) foundProperty = true;
  } catch (error) {
    errors.push({
      field: `addressLine2${indexSuffix}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let city: string | undefined = undefined;
  try {
    city = normalizeCitySafe(csvPatient[`city${indexSuffix}`]);
    if (!city) throw new Error(`Missing city${indexSuffix}`);
    foundProperty = true;
  } catch (error) {
    errors.push({
      field: `city${indexSuffix}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let state: USStateForAddress | undefined = undefined;
  try {
    state = normalizeUSStateForAddressSafe(csvPatient[`state${indexSuffix}`] ?? "");
    if (!state) throw new Error(`Missing state${indexSuffix}`);
    foundProperty = true;
  } catch (error) {
    errors.push({
      field: `state${indexSuffix}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let zip: string | undefined = undefined;
  try {
    zip = normalizeZipCodeNewSafe(csvPatient[`zip${indexSuffix}`] ?? "");
    if (!zip) throw new Error(`Missing zip${indexSuffix}`);
    foundProperty = true;
  } catch (error) {
    errors.push({
      field: `zip${indexSuffix}`,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (!addressLine1 || !city || !state || !zip) {
    if (foundProperty) return { address: undefined, errors };
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

function normalizeAddressLine(
  addressLine: string | undefined,
  propName: string,
  splitUnit: true
): string[];
function normalizeAddressLine(
  addressLine: string | undefined,
  propName: string,
  splitUnit?: false | undefined
): string;
function normalizeAddressLine(
  addressLine: string | undefined,
  propName: string,
  splitUnit = false
): string | string[] {
  if (addressLine == undefined) throw new Error(`Missing ` + propName);
  const withoutPunctuation = addressLine.replace(/[.,;]/g, " ");
  const withoutInstructions = withoutPunctuation.replace(/\(.*\)/g, " ");
  const normalized = toTitleCase(withoutInstructions);
  if (!splitUnit) return normalized;
  // Common street type variations in US addresses
  const match = (normalized + " ").match(pattern);
  if (match && match.flatMap(filterTruthy).length > 3) {
    const [, mainAddressMatch, , unitMatch] = match;
    const mainAddress = mainAddressMatch ? mainAddressMatch.trim() : undefined;
    const unit = unitMatch ? unitMatch.trim() : undefined;
    return [mainAddress, unit].flatMap(filterTruthy);
  }
  const matchExact = normalized.match(patternExact);
  if (matchExact && matchExact.flatMap(filterTruthy).length > 2) {
    const [, mainAddressMatch, unitMatch] = matchExact;
    const mainAddress = mainAddressMatch ? mainAddressMatch.trim() : undefined;
    const unit = unitMatch ? unitMatch.trim() : undefined;
    return [mainAddress, unit].flatMap(filterTruthy);
  }
  return [normalized];
}

export function normalizeCity(city: string | undefined): string {
  if (city == undefined) throw new Error(`Missing city`);
  return toTitleCase(city);
}

export function normalizeCitySafe(city: string | undefined): string | undefined {
  if (city == undefined) return undefined;
  return normalizeCity(city);
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
const pattern = new RegExp(
  `(.*?\\W+(${streetTypes.join("|")})\\W+.*?)\\s*((${unitIndicators.join(
    "|"
  )})\\s*[#]?\\s*[\\w\\s-]+)?$`,
  "i"
);
const patternExact = new RegExp(
  `(.+?)\\s*((${unitIndicatorsExact.join("|")})((\\s*#\\s*[\\w\\s-]+)|(\\s*[\\d\\s-]+)))?$`,
  "i"
);
