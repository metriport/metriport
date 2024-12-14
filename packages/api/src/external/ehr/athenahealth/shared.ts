import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import AthenaHealthApi, {
  AthenaEnv,
  isAthenaEnv,
} from "@metriport/core/external/athenahealth/index";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import {
  MetriportError,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
} from "@metriport/shared";
import { PatientResource } from "@metriport/shared/interface/external/athenahealth/patient";
import { Config } from "../../../shared/config";
import { EhrSources } from "../shared";
import { findOrCreateJwtToken, getLatestJwtTokenBySourceAndData } from "../../../command/jwt-token";

const region = Config.getAWSRegion();

export const athenaClientJwtTokenSource = `${EhrSources.athena}-client`;

export function createMetriportContacts(patient: PatientResource): Contact[] {
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

export function createMetriportAddresses(patient: PatientResource): Address[] {
  return patient.address.map(address => {
    if (address.line.length === 0) {
      throw new Error("AthenaHealth patient missing at least one line in address");
    }
    return {
      addressLine1: address.line[0] as string,
      addressLine2: address.line.length > 1 ? address.line.slice(1).join(" ") : undefined,
      city: address.city,
      state: normalizeUSStateForAddress(address.state),
      zip: normalizeZipCodeNew(address.postalCode),
      country: address.country,
    };
  });
}

export function createNames(patient: PatientResource): { firstName: string; lastName: string }[] {
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
  return names;
}

export async function createAthenaClient({
  cxId,
  practiceId,
  threeLeggedAuthToken,
}: {
  cxId: string;
  practiceId: string;
  threeLeggedAuthToken?: string;
}): Promise<AthenaHealthApi> {
  const { environment, clientKey, clientSecret } = await getAthenaEnv();
  const twoLeggedAuthToken = await getLatestAthenaClientJwtToken({ cxId, practiceId });
  const athenaApi = await AthenaHealthApi.create({
    twoLeggedAuthToken,
    threeLeggedAuthToken,
    practiceId,
    environment,
    clientKey,
    clientSecret,
  });
  if (!twoLeggedAuthToken) {
    const tokenInfo = athenaApi.getTwoLeggedAuthTokenInfo();
    if (!tokenInfo) throw new MetriportError("Client not created with two-legged auth token");
    await findOrCreateJwtToken({
      token: tokenInfo.token,
      exp: new Date(tokenInfo.exp),
      source: athenaClientJwtTokenSource,
      data: { cxId, practiceId, source: athenaClientJwtTokenSource },
    });
  }
  return athenaApi;
}

export async function getAthenaEnv(): Promise<{
  environment: AthenaEnv;
  clientKey: string;
  clientSecret: string;
}> {
  const environment = Config.getAthenaHealthEnv();
  if (!environment) throw new MetriportError("AthenaHealth environment not set");
  if (!isAthenaEnv(environment)) {
    throw new MetriportError("Invalid AthenaHealth environment", undefined, { environment });
  }
  const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArn();
  const athenaClientSecretSecretArn = Config.getAthenaHealthClientSecretArn();
  if (!athenaClientKeySecretArn || !athenaClientSecretSecretArn) {
    throw new MetriportError("AthenaHealth secrets not set");
  }
  const clientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
  const clientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);
  return {
    environment,
    clientKey,
    clientSecret,
  };
}

async function getLatestAthenaClientJwtToken({
  cxId,
  practiceId,
}: {
  cxId: string;
  practiceId: string;
}): Promise<string | undefined> {
  const token = await getLatestJwtTokenBySourceAndData({
    source: athenaClientJwtTokenSource,
    data: { cxId, practiceId, source: athenaClientJwtTokenSource },
  });
  if (!token) return undefined;
  if (token.exp < new Date()) return undefined;
  return token.token;
}
