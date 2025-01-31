import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import ElationApi, { ElationEnv, isElationEnv } from "@metriport/core/external/elation/index";
import {
  BadRequestError,
  cxClientKeyAndSecretMapSecretSchema,
  JwtTokenInfo,
  MetriportError,
  normalizeEmailNewSafe,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
  toTitleCase,
} from "@metriport/shared";
import { ElationClientJwtTokenData } from "@metriport/shared/interface/external/elation/jwt-token";
import { PatientWithAddress } from "@metriport/shared/interface/external/elation/patient";
import {
  findOrCreateJwtToken,
  getLatestExpiringJwtTokenBySourceAndData,
} from "../../../command/jwt-token";
import { Config } from "../../../shared/config";

export const elationClientJwtTokenSource = "elation-client";

export function createContacts(patient: PatientWithAddress): Contact[] {
  return [
    ...patient.emails.flatMap(e => {
      const email = normalizeEmailNewSafe(e.email);
      if (!email) return [];
      return { email };
    }),
    ...patient.phones.flatMap(p => {
      const phone = normalizePhoneNumberSafe(p.phone);
      if (!phone) return [];
      return { phone };
    }),
  ];
}

export function createAddresses(patient: PatientWithAddress): Address[] {
  const addressLine1 = patient.address.address_line1.trim();
  if (addressLine1 === "") throw new BadRequestError("Patient address address_line1 is empty");
  const addressLine2 = patient.address.address_line2?.trim();
  const city = patient.address.city.trim();
  if (city === "") throw new BadRequestError("Patient address city is empty");
  return [
    {
      addressLine1,
      addressLine2: !addressLine2 || addressLine2 === "" ? undefined : addressLine2,
      city,
      state: normalizeUSStateForAddress(patient.address.state),
      zip: normalizeZipCodeNew(patient.address.zip),
      country: "USA",
    },
  ];
}

export function createNames(patient: PatientWithAddress): { firstName: string; lastName: string } {
  const firstName = toTitleCase(patient.first_name.trim());
  const lastName = toTitleCase(patient.last_name.trim());
  const middleName = toTitleCase(patient.middle_name.trim());
  if (firstName === "" || lastName === "") {
    throw new BadRequestError("Patient first or last name is empty");
  }
  return {
    firstName: `${firstName}${middleName !== "" ? ` ${middleName}` : ""}`,
    lastName,
  };
}

export async function createElationClient({
  cxId,
  practiceId,
}: {
  cxId: string;
  practiceId: string;
}): Promise<ElationApi> {
  const [elationEnv, twoLeggedAuthTokenInfo] = await Promise.all([
    getElationEnv({ cxId, practiceId }),
    getLatestElationClientJwtTokenInfo({ cxId, practiceId }),
  ]);
  const elationApi = await ElationApi.create({
    twoLeggedAuthTokenInfo,
    practiceId,
    environment: elationEnv.environment,
    clientKey: elationEnv.clientKey,
    clientSecret: elationEnv.clientSecret,
  });
  const newAuthInfo = elationApi.getTwoLeggedAuthTokenInfo();
  if (!newAuthInfo) throw new MetriportError("Client not created with two-legged auth token");
  const data: ElationClientJwtTokenData = {
    cxId,
    practiceId,
    source: elationClientJwtTokenSource,
  };
  await findOrCreateJwtToken({
    token: newAuthInfo.access_token,
    exp: newAuthInfo.exp,
    source: elationClientJwtTokenSource,
    data,
  });
  return elationApi;
}

export async function getElationEnv({
  cxId,
  practiceId,
}: {
  cxId: string;
  practiceId: string;
}): Promise<{
  environment: ElationEnv;
  clientKey: string;
  clientSecret: string;
}> {
  const environment = Config.getElationEnv();
  if (!environment) throw new MetriportError("Elation environment not set");
  if (!isElationEnv(environment)) {
    throw new MetriportError("Invalid Elation environment", undefined, { environment });
  }
  const rawClientsMap = Config.getElationClientKeyAndSecretMap();
  if (!rawClientsMap) throw new MetriportError("Elation secrets map not set");
  const clientMap = cxClientKeyAndSecretMapSecretSchema.safeParse(JSON.parse(rawClientsMap));
  if (!clientMap.success) throw new MetriportError("Elation clients map has invalid format");
  const cxKey = `${cxId}_${practiceId}_key`;
  const cxKeyEntry = clientMap.data[cxKey];
  const cxSecret = `${cxId}_${practiceId}_secret`;
  const cxSecretEntry = clientMap.data[cxSecret];
  if (!cxKeyEntry || !cxSecretEntry) throw new MetriportError("Elation credentials not found");
  return {
    environment,
    clientKey: cxKeyEntry,
    clientSecret: cxSecretEntry,
  };
}

async function getLatestElationClientJwtTokenInfo({
  cxId,
  practiceId,
}: {
  cxId: string;
  practiceId: string;
}): Promise<JwtTokenInfo | undefined> {
  const data: ElationClientJwtTokenData = {
    cxId,
    practiceId,
    source: elationClientJwtTokenSource,
  };
  const token = await getLatestExpiringJwtTokenBySourceAndData({
    source: elationClientJwtTokenSource,
    data,
  });
  if (!token) return undefined;
  return {
    access_token: token.token,
    exp: token.exp,
  };
}
