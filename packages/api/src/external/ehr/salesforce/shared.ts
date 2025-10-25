import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { EhrPerPracticeParams } from "@metriport/core/external/ehr/environment";
import { getSalesforceEnv } from "@metriport/core/external/ehr/salesforce/environment";
import SalesforceApi from "@metriport/core/external/ehr/salesforce/index";
import { SalesforcePatient } from "@metriport/core/external/ehr/salesforce/object-handlers";
import {
  BadRequestError,
  normalizeCountrySafe,
  normalizedCountryUsa,
  normalizeEmailNewSafe,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  toTitleCase,
} from "@metriport/shared";

type SalesforcePerPracticeParams = EhrPerPracticeParams & {
  authToken: string;
  instanceUrl: string;
};

export async function createSalesforceClient(
  perPracticeParams: SalesforcePerPracticeParams
): Promise<SalesforceApi> {
  const { environment } = getSalesforceEnv();
  return await SalesforceApi.create({
    practiceId: perPracticeParams.practiceId,
    environment,
    authToken: perPracticeParams.authToken,
    instanceUrl: perPracticeParams.instanceUrl,
  });
}

export function createAddresses(patient: SalesforcePatient): Address[] {
  const addressLine1 = patient.mailingStreet?.trim();
  if (!addressLine1) return [];
  const addressLine2 = undefined; // for now parsing only 1 line of address
  const city = patient.mailingCity?.trim();
  if (!city) return [];
  const country =
    normalizeCountrySafe(patient.mailingCountry?.trim() ?? "") ?? normalizedCountryUsa;
  const state = normalizeUSStateForAddressSafe(patient.mailingState ?? "");
  if (!state) return [];
  const zip = normalizeZipCodeNewSafe(patient.mailingPostalCode ?? "");
  if (!zip) return [];
  const addresses = [
    {
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      country,
    },
  ];
  if (addresses.length === 0) {
    throw new BadRequestError("Patient has no valid addresses", undefined, {
      address: JSON.stringify(patient),
    });
  }
  return addresses;
}

export function createContacts(patient: SalesforcePatient): Contact[] {
  const email = patient.email ? normalizeEmailNewSafe(patient.email) : undefined;
  const phone = patient.phone ? normalizePhoneNumberSafe(patient.phone) : undefined;
  return [
    {
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    },
  ];
}

export function createNames(patient: SalesforcePatient): {
  firstName: string;
  lastName: string;
} {
  if (!patient.firstName) throw new BadRequestError("Patient first name is empty");
  const firstName = toTitleCase(patient.firstName.trim());
  if (firstName === "") throw new BadRequestError("Patient first name is empty");
  if (!patient.lastName) throw new BadRequestError("Patient last name is empty");
  const lastName = toTitleCase(patient.lastName.trim());
  if (lastName === "") throw new BadRequestError("Patient last name is empty");
  return {
    firstName,
    lastName,
  };
}
