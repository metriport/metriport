import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { EhrPerPracticeParams } from "@metriport/core/external/ehr/environment";
import { getSalesforceEnv } from "@metriport/core/external/ehr/salesforce/environment";
import SalesforceApi from "@metriport/core/external/ehr/salesforce/index";
import {
  BadRequestError,
  normalizedCountryUsa,
  normalizeEmailNewSafe,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  toTitleCase,
} from "@metriport/shared";
import { Patient as SalesforcePatient } from "@metriport/shared/interface/external/ehr/salesforce/patient";

type SalesforcePerPracticeParams = EhrPerPracticeParams & {
  authToken: string;
  instanceUrl: string;
  orgId: string;
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
    orgId: perPracticeParams.orgId,
  });
}

export function createAddresses(patient: SalesforcePatient): Address[] {
  const addresses = [patient].flatMap(address => {
    const addressLine1 = address.MailingStreet?.trim();
    if (!addressLine1) return [];
    const addressLine2 = undefined; // for now parsing only 1 line of address
    const city = address.MailingCity?.trim();
    if (!city) return [];
    const country = address.MailingCountry?.trim() ?? normalizedCountryUsa;
    const state = normalizeUSStateForAddressSafe(address.MailingState ?? "");
    if (!state) return [];
    const zip = normalizeZipCodeNewSafe(address.MailingPostalCode ?? "");
    if (!zip) return [];
    return {
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      country,
    };
  });
  if (addresses.length === 0) {
    throw new BadRequestError("Patient has no valid addresses", undefined, {
      address: JSON.stringify(patient),
    });
  }
  return addresses;
}

export function createContacts(patient: SalesforcePatient): Contact[] {
  const email = patient.Email ? normalizeEmailNewSafe(patient.Email) : undefined;
  const phone = patient.Phone ? normalizePhoneNumberSafe(patient.Phone) : undefined;
  return [
    {
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    },
  ];
}

export function createNames(patient: SalesforcePatient): { firstName: string; lastName: string } {
  if (!patient.FirstName) throw new BadRequestError("Patient has no first_name");
  const firstName = toTitleCase(patient.FirstName.trim());
  if (firstName === "") throw new BadRequestError("Patient first_name is empty");
  if (!patient.LastName) throw new BadRequestError("Patient has no last_name");
  const lastName = toTitleCase(patient.LastName.trim());
  if (lastName === "") throw new BadRequestError("Patient last_name is empty");
  return {
    firstName,
    lastName,
  };
}
