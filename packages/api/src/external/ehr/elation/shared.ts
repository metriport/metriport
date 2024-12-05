import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { ElationEnv, isElationEnv } from "@metriport/core/external/elation/index";
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
  return [
    {
      addressLine1: patient.address.address_line1,
      addressLine2:
        patient.address.address_line2.trim() !== "" ? patient.address.address_line2 : undefined,
      city: patient.address.city,
      state: normalizeUSStateForAddress(patient.address.state),
      zip: normalizeZipCodeNew(patient.address.zip),
      country: "USA",
    },
  ];
}

export function createNames(patient: PatientResource): { firstName: string; lastName: string } {
  return {
    firstName: `${patient.first_name}${
      patient.middle_name !== "" ? ` ${patient.middle_name}` : ""
    }`,
    lastName: patient.last_name,
  };
}

export async function getElationClientKeyAndSecret({
  cxId,
  practiceId,
}: {
  cxId: string;
  practiceId: string;
}): Promise<{
  clientKey: string;
  clientSecret: string;
}> {
  const rawClientsMap = Config.getElationClientKeyAndSecretMap();
  if (!rawClientsMap) throw new MetriportError("Elation secrets map not set");
  const clientMap = cxClientKeyAndSecretMapSecretSchema.safeParse(JSON.parse(rawClientsMap));
  if (!clientMap.success) throw new MetriportError("Elation clients map has invalid format");
  const cxKey = `${cxId}_${practiceId}_key`;
  const cxEntryKey = clientMap.data[cxKey];
  const cxSecret = `${cxId}_${practiceId}_secret`;
  const cxEntrySecret = clientMap.data[cxSecret];
  if (!cxEntryKey || !cxEntrySecret) {
    throw new MetriportError("Key or secret not found in Elation clients map", undefined, {
      cxId,
      practiceId,
      cxKey,
      cxSecret,
    });
  }
  return {
    clientKey: cxEntryKey,
    clientSecret: cxEntrySecret,
  };
}

export function getElationEnv(): ElationEnv {
  const environment = Config.getElationEnv();
  if (!environment) throw new MetriportError("Elation environment not set");
  if (!isElationEnv(environment)) {
    throw new MetriportError("Invalid Elation environment", undefined, { environment });
  }
  return environment;
}
