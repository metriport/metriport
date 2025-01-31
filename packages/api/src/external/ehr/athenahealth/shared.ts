import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import AthenaHealthApi, {
  AthenaEnv,
  isAthenaEnv,
} from "@metriport/core/external/athenahealth/index";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import {
  BadRequestError,
  JwtTokenInfo,
  MetriportError,
  normalizeEmailNewSafe,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  toTitleCase,
} from "@metriport/shared";
import { AthenaClientJwtTokenData } from "@metriport/shared/interface/external/athenahealth/jwt-token";
import { PatientWithValidHomeAddress } from "@metriport/shared/interface/external/athenahealth/patient";
import {
  findOrCreateJwtToken,
  getLatestExpiringJwtTokenBySourceAndData,
} from "../../../command/jwt-token";
import { Config } from "../../../shared/config";

const region = Config.getAWSRegion();

export const athenaClientJwtTokenSource = "athenahealth-client";

export function createContacts(patient: PatientWithValidHomeAddress): Contact[] {
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

export function createAddresses(patient: PatientWithValidHomeAddress): Address[] {
  const addresses = patient.address.flatMap(address => {
    if (address.line.length === 0) return [];
    const addressLine1 = (address.line[0] as string).trim();
    if (addressLine1 === "") return [];
    const addressLines2plus = address.line
      .slice(1)
      .map(l => l.trim())
      .filter(l => l !== "");
    const city = address.city.trim();
    if (city === "") return [];
    const country = address.country.trim();
    if (country === "") return [];
    const state = normalizeUSStateForAddressSafe(address.state);
    if (!state) return [];
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
  if (addresses.length === 0) throw new BadRequestError("Patient has no valid addresses");
  return addresses;
}

export function createNames(
  patient: PatientWithValidHomeAddress
): { firstName: string; lastName: string }[] {
  const names = patient.name.flatMap(name => {
    const lastName = name.family.trim();
    if (lastName === "") return [];
    return name.given.flatMap(gName => {
      const firstName = gName.trim();
      if (firstName === "") return [];
      return [{ firstName: toTitleCase(firstName), lastName: toTitleCase(lastName) }];
    });
  });
  if (names.length === 0) throw new BadRequestError("Patient has no valid names");
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
  const [athenaEnv, twoLeggedAuthTokenInfo] = await Promise.all([
    getAthenaEnv(),
    getLatestAthenaClientJwtTokenInfo({ cxId, practiceId }),
  ]);
  const athenaApi = await AthenaHealthApi.create({
    twoLeggedAuthTokenInfo,
    threeLeggedAuthToken,
    practiceId,
    environment: athenaEnv.environment,
    clientKey: athenaEnv.clientKey,
    clientSecret: athenaEnv.clientSecret,
  });
  const newAuthInfo = athenaApi.getTwoLeggedAuthTokenInfo();
  if (!newAuthInfo) throw new MetriportError("Client not created with two-legged auth token");
  const data: AthenaClientJwtTokenData = {
    cxId,
    practiceId,
    source: athenaClientJwtTokenSource,
  };
  await findOrCreateJwtToken({
    token: newAuthInfo.access_token,
    exp: newAuthInfo.exp,
    source: athenaClientJwtTokenSource,
    data,
  });
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

async function getLatestAthenaClientJwtTokenInfo({
  cxId,
  practiceId,
}: {
  cxId: string;
  practiceId: string;
}): Promise<JwtTokenInfo | undefined> {
  const data: AthenaClientJwtTokenData = {
    cxId,
    practiceId,
    source: athenaClientJwtTokenSource,
  };
  const token = await getLatestExpiringJwtTokenBySourceAndData({
    source: athenaClientJwtTokenSource,
    data,
  });
  if (!token) return undefined;
  return {
    access_token: token.token,
    exp: token.exp,
  };
}
