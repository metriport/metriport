import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import {
  clientKeySchema,
  MetriportError,
  normalizeEmail,
  normalizePhoneNumber,
  normalizeUSStateForAddress,
  normalizeZipCodeNew,
} from "@metriport/shared";
import { PatientResource } from "@metriport/shared/interface/external/elation/patient";
import { getClientKeyMappingOrFail } from "../../../command/mapping/client-key";
import { Config } from "../../../shared/config";
import { EhrSources } from "../shared";

const region = Config.getAWSRegion();

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
        patient.address.address_line2 !== "" ? patient.address.address_line2 : undefined,
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
  const { clientSecretArn } = await getClientKeyMappingOrFail({
    cxId,
    source: EhrSources.elation,
    externalId: practiceId,
  });
  const clientSecretRaw = await getSecretValueOrFail(clientSecretArn, region);
  const parsed = JSON.parse(clientSecretRaw);
  const zodParsed = clientKeySchema.safeParse(parsed);
  if (!zodParsed.success) {
    throw new MetriportError("Invalid Elation client secret", undefined, {
      clientSecretArn,
    });
  }
  return zodParsed.data;
}
