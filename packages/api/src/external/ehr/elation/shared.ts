import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { ElationEnv, isElationEnv } from "@metriport/core/src/external/elation";
import {
  clientKeyAndSecretMapsSecretSchema,
  MetriportError,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
} from "@metriport/shared";
import { PatientResource } from "@metriport/shared/interface/external/elation/patient";
import { getSecretsMappingOrFail } from "../../../command/mapping/secrets";
import { Config } from "../../../shared/config";
import { EhrSources } from "../shared";

const region = Config.getAWSRegion();

export const MAP_KEY_SEPARATOR = "|||";

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
  const { secretArn } = await getSecretsMappingOrFail({
    cxId,
    source: EhrSources.elation,
    externalId: practiceId,
  });
  const clientSecretRaw = await getSecretValueOrFail(secretArn, region);
  const parsed = JSON.parse(clientSecretRaw);
  const secretMap = clientKeyAndSecretMapsSecretSchema.safeParse(parsed);
  if (!secretMap.success) {
    throw new MetriportError("Invalid Elation key and secret map format", undefined, {
      secretArn,
    });
  }
  const cxEntry = secretMap.data[`${cxId}_${practiceId}`];
  if (!cxEntry) {
    throw new MetriportError(
      "CxId and PracticeId key not found in Elation key and secret map",
      undefined,
      {
        secretArn,
        cxId,
        practiceId,
      }
    );
  }
  return cxEntry;
}

export function getElationEnv(): ElationEnv {
  const env = Config.getElationEnv();
  if (!env) throw new MetriportError("Elation environment not set");
  if (!isElationEnv(env)) {
    throw new MetriportError("Invalid Elation environment", undefined, { env });
  }
  return env;
}
