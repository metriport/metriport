import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import ElationApi, { ElationEnv, isElationEnv } from "@metriport/core/external/elation/index";
import {
  cxClientKeyAndSecretMapSecretSchema,
  MetriportError,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
} from "@metriport/shared";
import { PatientResource } from "@metriport/shared/interface/external/elation/patient";
import { Config } from "../../../shared/config";

export function createMetriportContacts(patient: PatientResource): Contact[] {
  return [
    ...patient.phones.map(p => {
      return {
        phone: normalizePhoneNumber(p.phone),
      };
    }),
    ...patient.emails.map(e => {
      return {
        email: normalizeEmail(e.email),
      };
    }),
  ];
}

export function createMetriportAddresses(patient: PatientResource): Address[] {
  const addressLine1 = patient.address.address_line1.trim();
  if (addressLine1 === "") throw new Error("Elation patient address first line is empty");
  const addressLine2 = patient.address.address_line2?.trim();
  const city = patient.address.city.trim();
  if (city === "") throw new Error("Elation patient address city is empty");
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

export function createNames(patient: PatientResource): { firstName: string; lastName: string } {
  const firstName = patient.first_name.trim();
  const lastName = patient.last_name.trim();
  const middleName = patient.middle_name.trim();
  if (firstName === "" || lastName === "") {
    throw new Error("Elation patient has empty first or last name");
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
  const { environment, clientKey, clientSecret } = await getElationEnv({
    cxId,
    practiceId,
  });
  return await ElationApi.create({
    practiceId,
    environment,
    clientKey,
    clientSecret,
  });
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
