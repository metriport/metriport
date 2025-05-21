import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import ElationApi, { ElationEnv, isElationEnv } from "@metriport/core/external/ehr/elation/index";
import {
  BadRequestError,
  cxClientKeyAndSecretMapSecretSchema,
  EhrSources,
  MetriportError,
  normalizeEmailNewSafe,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
  NotFoundError,
  toTitleCase,
} from "@metriport/shared";
import { elationSecondaryMappingsSchema } from "@metriport/shared/interface/external/ehr/elation/cx-mapping";
import { Patient as ElationPatient } from "@metriport/shared/interface/external/ehr/elation/patient";
import { SubscriptionResource } from "@metriport/shared/interface/external/ehr/elation/subscription";
import dayjs from "dayjs";
import { getCxMappingOrFail } from "../../../command/mapping/cx";
import { Config } from "../../../shared/config";
import {
  createEhrClient,
  EhrEnvAndClientCredentials,
  EhrPerPracticeParams,
} from "../shared/utils/client";

export const elationClientJwtTokenSource = "elation-client";
export const elationWebhookJwtTokenSource = "elation-webhook";
export const elationWebhookCreatedDateDiffSeconds = dayjs.duration(5, "seconds");

export function createContacts(patient: ElationPatient): Contact[] {
  return [
    ...(patient.emails ?? []).flatMap(e => {
      const email = normalizeEmailNewSafe(e.email);
      if (!email) return [];
      return { email };
    }),
    ...(patient.phones ?? []).flatMap(p => {
      const phone = normalizePhoneNumberSafe(p.phone);
      if (!phone) return [];
      return { phone };
    }),
  ];
}

export function createAddresses(patient: ElationPatient): Address[] {
  if (!patient.address) throw new BadRequestError("Patient has no address");
  if (!patient.address.address_line1) throw new BadRequestError("Patient has no address_line1");
  const addressLine1 = patient.address.address_line1.trim();
  if (addressLine1 === "") throw new BadRequestError("Patient address address_line1 is empty");
  const addressLine2 = patient.address.address_line2?.trim();
  if (!patient.address.city) throw new BadRequestError("Patient has no city");
  const city = patient.address.city.trim();
  if (city === "") throw new BadRequestError("Patient address city is empty");
  if (!patient.address.state) throw new BadRequestError("Patient has no state");
  const state = normalizeUSStateForAddress(patient.address.state);
  if (!patient.address.zip) throw new BadRequestError("Patient has no zip");
  const zip = normalizeZipCodeNew(patient.address.zip);
  return [
    {
      addressLine1,
      addressLine2: !addressLine2 || addressLine2 === "" ? undefined : addressLine2,
      city,
      state,
      zip,
      country: "USA",
    },
  ];
}

export function createNames(patient: ElationPatient): { firstName: string; lastName: string } {
  if (!patient.first_name) throw new BadRequestError("Patient has no first_name");
  const firstName = toTitleCase(patient.first_name.trim());
  if (firstName === "") throw new BadRequestError("Patient first_name is empty");
  if (!patient.last_name) throw new BadRequestError("Patient has no last_name");
  const lastName = toTitleCase(patient.last_name.trim());
  if (lastName === "") throw new BadRequestError("Patient last_name is empty");
  const middleName = patient.middle_name ? toTitleCase(patient.middle_name.trim()) : undefined;
  return {
    firstName: `${firstName}${middleName && middleName !== "" ? ` ${middleName}` : ""}`,
    lastName,
  };
}

export function getElationEnv({
  cxId,
  practiceId,
}: EhrPerPracticeParams): EhrEnvAndClientCredentials<ElationEnv> {
  const environment = Config.getElationEnv();
  if (!environment) throw new MetriportError("Elation environment not set");
  if (!isElationEnv(environment)) {
    throw new MetriportError("Invalid Elation environment", undefined, { environment });
  }
  const clientMap = getClientMap();
  const key = `${cxId}_${practiceId}_key`;
  const keyEntry = clientMap[key];
  const secret = `${cxId}_${practiceId}_secret`;
  const secretEntry = clientMap[secret];
  if (!keyEntry || !secretEntry) throw new MetriportError("Elation credentials not found");
  return {
    environment,
    clientKey: keyEntry,
    clientSecret: secretEntry,
  };
}

function getCxIdAndPracticeIdFromElationApplicationId(applicationId: string): {
  cxId: string;
  practiceId: string;
} {
  const clientMap = getClientMap();
  const entry = Object.entries(clientMap).find(([, v]) => v === applicationId);
  if (!entry) throw new MetriportError("Elation application id not found");
  const key = entry[0];
  const keySplit = key.split("_");
  if (keySplit.length !== 3) throw new MetriportError("Elation key for application id malformed");
  const cxId = keySplit[0];
  const practiceId = keySplit[1];
  if (!cxId || !practiceId) throw new MetriportError("Elation cxId or practiceId not found");
  return { cxId, practiceId };
}

export async function createElationClientWithTokenIdAndEnvironment(
  perPracticeParams: EhrPerPracticeParams
): Promise<{ client: ElationApi; tokenId: string; environment: ElationEnv }> {
  return await createEhrClient<ElationEnv, ElationApi, EhrPerPracticeParams>({
    ...perPracticeParams,
    source: elationClientJwtTokenSource,
    getEnv: { params: perPracticeParams, getEnv: getElationEnv },
    getClient: ElationApi.create,
  });
}

export async function createElationClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<ElationApi> {
  const { client } = await createElationClientWithTokenIdAndEnvironment(perPracticeParams);
  return client;
}

export async function getElationSigningKeyInfo(
  applicationId: string,
  resource: SubscriptionResource
): Promise<{
  cxId: string;
  practiceId: string;
  signingKey: string;
}> {
  const { cxId, practiceId } = getCxIdAndPracticeIdFromElationApplicationId(applicationId);
  const cxMapping = await getCxMappingOrFail({
    externalId: practiceId,
    source: EhrSources.elation,
  });
  if (!cxMapping.secondaryMappings) {
    throw new MetriportError("Elation secondary mappings not found", undefined, {
      externalId: practiceId,
      source: EhrSources.elation,
    });
  }
  const secondaryMappings = elationSecondaryMappingsSchema.parse(cxMapping.secondaryMappings);
  const signingKey = secondaryMappings.webhooks?.[resource]?.signingKey;
  if (!signingKey) {
    throw new NotFoundError("Elation signing key not found", {
      externalId: practiceId,
      source: EhrSources.elation,
    });
  }
  return { cxId, practiceId, signingKey };
}

function getClientMap() {
  const rawClientsMap = Config.getElationClientKeyAndSecretMap();
  if (!rawClientsMap) throw new MetriportError("Elation secrets map not set");
  const clientMap = cxClientKeyAndSecretMapSecretSchema.safeParse(JSON.parse(rawClientsMap));
  if (!clientMap.success) throw new MetriportError("Elation clients map has invalid format");
  return clientMap.data;
}
