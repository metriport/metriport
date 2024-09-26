import {
  PatientResource,
  athenaSecondaryMappingsSchema,
  AthenaSecondaryMappings,
  AthenaJwtTokenData,
} from "@metriport/shared";
import {
  normalizeEmail,
  normalizePhoneNumber,
  normalizeState,
  normalizeZipCode,
} from "@metriport/shared";
import { Contact } from "@metriport/core/domain/contact";
import { Address } from "@metriport/core/domain/address";
import { EhrSources } from "../shared";
import { CxMappingParams, cxMappingSourceMap } from "../../../domain/cx-mapping";
import { facilityMappingSourceList } from "../../../domain/facility-mapping";
import { JwtTokenParams } from "../../../domain/jwt-token";

cxMappingSourceMap.set(EhrSources.athena, { bodyParser: athenaSecondaryMappingsSchema });
facilityMappingSourceList.push(EhrSources.athena);

export type AthenaSource = `${EhrSources.athena}`;

export type AthenaCxMappingParams = Pick<CxMappingParams, "cxId" | "externalId"> & {
  source: AthenaSource;
  secondaryMappings: AthenaSecondaryMappings | null;
};

export type AthenaJwtTokenParams = Pick<JwtTokenParams, "token" | "exp"> & {
  source: AthenaSource;
  data: AthenaJwtTokenData;
};

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
      state: normalizeState(address.state),
      zip: normalizeZipCode(address.postalCode),
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
