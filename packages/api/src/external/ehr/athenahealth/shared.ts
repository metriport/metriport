import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import AthenaHealthApi, {
  AthenaEnv,
  isAthenaEnv,
} from "@metriport/core/external/athenahealth/index";
import {
  BadRequestError,
  MetriportError,
  normalizeEmailNewSafe,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  toTitleCase,
} from "@metriport/shared";
import { Patient as AthenaPatient } from "@metriport/shared/interface/external/athenahealth/patient";
import { Config } from "../../../shared/config";
import {
  createEhrClient,
  EhrClientUniqueClientParams,
  EhrEnvAndClientCredentials,
} from "../shared";

export const athenaClientJwtTokenSource = "athenahealth-client";

export function createContacts(patient: AthenaPatient): Contact[] {
  return (patient.telecom ?? []).flatMap(telecom => {
    if (telecom.system === "email") {
      const email = normalizeEmailNewSafe(telecom.value);
      if (!email) return [];
      return { email };
    } else if (telecom.system === "phone") {
      const phone = normalizePhoneNumberSafe(telecom.value);
      if (!phone) return [];
      return { phone };
    }
    return [];
  });
}

export function createAddresses(patient: AthenaPatient): Address[] {
  if (!patient.address) throw new BadRequestError("Patient has no address");
  const addresses = patient.address.flatMap(address => {
    if (!address.line || address.line.length === 0) return [];
    const addressLine1 = (address.line[0] as string).trim();
    if (addressLine1 === "") return [];
    const addressLines2plus = address.line
      .slice(1)
      .map(l => l.trim())
      .filter(l => l !== "");
    if (!address.city) return [];
    const city = address.city.trim();
    if (city === "") return [];
    if (!address.country) return [];
    const country = address.country.trim();
    if (country === "") return [];
    if (!address.state) return [];
    const state = normalizeUSStateForAddressSafe(address.state);
    if (!state) return [];
    if (!address.postalCode) return [];
    const zip = normalizeZipCodeNewSafe(address.postalCode);
    if (!zip) return [];
    return {
      addressLine1,
      addressLine2: addressLines2plus.length === 0 ? undefined : addressLines2plus.join(" "),
      city,
      state,
      zip,
      country,
    };
  });
  if (addresses.length === 0)
    throw new BadRequestError("Patient has no valid addresses", undefined, {
      addresses: Object.values(addresses)
        .map(a => JSON.stringify(a))
        .join(","),
    });
  return addresses;
}

export function createNames(patient: AthenaPatient): { firstName: string; lastName: string }[] {
  if (!patient.name) throw new BadRequestError("Patient has no name");
  const names = patient.name.flatMap(name => {
    const lastName = name.family.trim();
    if (lastName === "") return [];
    return name.given.flatMap(gName => {
      const firstName = gName.trim();
      if (firstName === "") return [];
      return [{ firstName: toTitleCase(firstName), lastName: toTitleCase(lastName) }];
    });
  });
  if (names.length === 0)
    throw new BadRequestError("Patient has no valid names", undefined, {
      names: patient.name.map(n => JSON.stringify(n)).join(","),
    });
  return names;
}

function getAthenaEnv(): EhrEnvAndClientCredentials<AthenaEnv> {
  const environment = Config.getAthenaHealthEnv();
  if (!environment) throw new MetriportError("AthenaHealth environment not set");
  if (!isAthenaEnv(environment)) {
    throw new MetriportError("Invalid AthenaHealth environment", undefined, { environment });
  }
  const clientKey = Config.getAthenaHealthClientKey();
  const clientSecret = Config.getAthenaHealthClientSecret();
  if (!clientKey || !clientSecret) throw new MetriportError("AthenaHealth secrets not set");
  return {
    environment,
    clientKey,
    clientSecret,
  };
}

export async function createAthenaClient(
  unqiueParams: EhrClientUniqueClientParams
): Promise<AthenaHealthApi> {
  return await createEhrClient<AthenaEnv, AthenaHealthApi>({
    ...unqiueParams,
    source: athenaClientJwtTokenSource,
    getEnv: { params: undefined, getEnv: getAthenaEnv },
    getClient: AthenaHealthApi.create,
  });
}
