import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import AthenaHealthApi, {
  AthenaEnv,
  isAthenaEnv,
} from "@metriport/core/external/athenahealth/index";
import {
  MetriportError,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
} from "@metriport/shared";
import { PatientWithValidHomeAddress } from "@metriport/shared/interface/external/athenahealth/patient";
import { Config } from "../../../shared/config";
import { createEhrClient, EhrEnvAndClientCredentials } from "../shared";

export const athenaClientJwtTokenSource = "athenahealth-client";

export function createMetriportContacts(patient: PatientWithValidHomeAddress): Contact[] {
  return (patient.telecom ?? []).flatMap(telecom => {
    if (telecom.system === "email") {
      return {
        email: normalizeEmail(telecom.value),
      };
    } else if (telecom.system === "phone") {
      return {
        phone: normalizePhoneNumber(telecom.value),
      };
    }
    return [];
  });
}

export function createMetriportAddresses(patient: PatientWithValidHomeAddress): Address[] {
  return patient.address.map(address => {
    if (address.line.length === 0) {
      throw new Error("AthenaHealth patient missing at least one line in address");
    }
    const addressLine1 = (address.line[0] as string).trim();
    if (addressLine1 === "") throw new Error("AthenaHealth patient address first line is empty");
    const addressLines2plus = address.line
      .slice(1)
      .map(l => l.trim())
      .filter(l => l !== "");
    const city = address.city.trim();
    if (city === "") throw new Error("AthenaHealth patient address city is empty");
    const country = address.country.trim();
    if (country === "") throw new Error("AthenaHealth patient address country is empty");
    return {
      addressLine1,
      addressLine2: addressLines2plus.length > 0 ? addressLines2plus.join(" ") : undefined,
      city,
      state: normalizeUSStateForAddress(address.state),
      zip: normalizeZipCodeNew(address.postalCode),
      country: address.country,
    };
  });
}

export function createNames(
  patient: PatientWithValidHomeAddress
): { firstName: string; lastName: string }[] {
  const names: { firstName: string; lastName: string }[] = [];
  patient.name.map(name => {
    const lastName = name.family.trim();
    if (lastName === "") return;
    name.given.map(gName => {
      const firstName = gName.trim();
      if (firstName === "") return;
      names.push({ firstName, lastName });
    });
  });
  if (names.length === 0) {
    throw new Error("AthenaHealth patient has only empty first or last names");
  }
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

export async function createAthenaClient({
  cxId,
  practiceId,
}: {
  cxId: string;
  practiceId: string;
}): Promise<AthenaHealthApi> {
  return await createEhrClient<undefined, AthenaEnv, AthenaHealthApi>({
    cxId,
    practiceId,
    source: athenaClientJwtTokenSource,
    getEnv: getAthenaEnv,
    getEnvParams: undefined,
    getClient: AthenaHealthApi.create,
  });
}
