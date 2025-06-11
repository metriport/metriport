import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { EhrPerPracticeParams } from "@metriport/core/external/ehr/environment";
import { getHealthieEnv } from "@metriport/core/external/ehr/healthie/environment";
import HealthieApi, { HealthieEnv } from "@metriport/core/external/ehr/healthie/index";
import {
  BadRequestError,
  MetriportError,
  normalizeCountrySafe,
  normalizedCountryUsa,
  normalizeEmailNewSafe,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  NotFoundError,
  toTitleCase,
} from "@metriport/shared";
import { healthieSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/healthie/cx-mapping";
import { Patient as HealthiePatient } from "@metriport/shared/interface/external/ehr/healthie/patient";
import { SubscriptionResource } from "@metriport/shared/interface/external/ehr/healthie/subscription";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import { getCxMappingOrFail } from "../../../command/mapping/cx";

export const healthieWebhookCreatedDateDiffSeconds = dayjs.duration(5, "seconds");

export function createContacts(patient: HealthiePatient): Contact[] {
  const email = patient.email ? normalizeEmailNewSafe(patient.email) : undefined;
  const phone = patient.phone_number ? normalizePhoneNumberSafe(patient.phone_number) : undefined;
  return [
    {
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    },
  ];
}

export function createAddresses(patient: HealthiePatient): Address[] {
  const addresses = patient.locations.flatMap(address => {
    const addressLine1 = address.line1.trim();
    if (addressLine1 === "") return [];
    const addressLine2 = address.line2.trim() !== "" ? address.line2.trim() : undefined;
    const city = address.city.trim();
    if (city === "") return [];
    const country = normalizeCountrySafe(address.country) ?? normalizedCountryUsa;
    const state = normalizeUSStateForAddressSafe(address.state);
    if (!state) return [];
    const zip = normalizeZipCodeNewSafe(address.zip);
    if (!zip) return [];
    return {
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      country,
    };
  });
  if (addresses.length === 0) {
    throw new BadRequestError("Patient has no valid addresses", undefined, {
      addresses: patient.locations?.map(a => JSON.stringify(a)).join(","),
    });
  }
  return addresses;
}

export function createNames(patient: HealthiePatient): { firstName: string; lastName: string } {
  if (!patient.first_name) throw new BadRequestError("Patient has no first_name");
  const firstName = toTitleCase(patient.first_name.trim());
  if (firstName === "") throw new BadRequestError("Patient first_name is empty");
  if (!patient.last_name) throw new BadRequestError("Patient has no last_name");
  const lastName = toTitleCase(patient.last_name.trim());
  if (lastName === "") throw new BadRequestError("Patient last_name is empty");
  return {
    firstName,
    lastName,
  };
}

export async function createHealthieClientWithEnvironment(
  perPracticeParams: EhrPerPracticeParams
): Promise<{ client: HealthieApi; environment: HealthieEnv }> {
  const { environment, apiKey } = getHealthieEnv(perPracticeParams);
  const client = await HealthieApi.create({
    practiceId: perPracticeParams.practiceId,
    environment,
    apiKey,
  });
  return { client, environment };
}

export async function createHealthieClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<HealthieApi> {
  const { client } = await createHealthieClientWithEnvironment(perPracticeParams);
  return client;
}

export async function getHealthieSecretKeyInfo(
  practiceId: string,
  resource: SubscriptionResource
): Promise<{
  cxId: string;
  practiceId: string;
  secretKey: string;
}> {
  const cxMapping = await getCxMappingOrFail({
    externalId: practiceId,
    source: EhrSources.healthie,
  });
  if (!cxMapping.secondaryMappings) {
    throw new MetriportError("Healthie secondary mappings not found", undefined, {
      externalId: practiceId,
      source: EhrSources.healthie,
    });
  }
  const secondaryMappings = healthieSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
  const secretKey = secondaryMappings.webhooks?.[resource]?.secretKey;
  if (!secretKey) {
    throw new NotFoundError("Healthie secret key not found", {
      externalId: practiceId,
      source: EhrSources.healthie,
    });
  }
  return { cxId: cxMapping.cxId, practiceId, secretKey };
}

export enum LookupModes {
  Appointments = "appointments",
  Appointments48hr = "appointments-48hr",
}
export const lookupModes = [...Object.values(LookupModes)] as const;
export type LookupMode = (typeof lookupModes)[number];
export function isLookupMode(value: string): value is LookupMode {
  return lookupModes.includes(value as LookupMode);
}
