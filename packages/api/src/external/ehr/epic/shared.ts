import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { EhrPerPracticeParams } from "@metriport/core/external/ehr/environment";
import { getEpicEnv } from "@metriport/core/external/ehr/epic/environment";
import EpicApi from "@metriport/core/external/ehr/epic/index";
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
import { Patient as EpicPatient } from "@metriport/shared/interface/external/ehr/epic/patient";

type EpicPerPracticeParams = EhrPerPracticeParams & {
  authToken: string;
  instanceUrl: string;
};

export async function createEpicClient(perPracticeParams: EpicPerPracticeParams): Promise<EpicApi> {
  const { environment } = getEpicEnv();
  return await EpicApi.create({
    practiceId: perPracticeParams.practiceId,
    environment,
    authToken: perPracticeParams.authToken,
    instanceUrl: perPracticeParams.instanceUrl,
  });
}

export function createAddresses(patient: EpicPatient): Address[] {
  const addressLine1 = patient.MailingStreet?.trim();
  if (!addressLine1) return [];
  const addressLine2 = undefined; // for now parsing only 1 line of address
  const city = patient.MailingCity?.trim();
  if (!city) return [];
  const country =
    normalizeCountrySafe(patient.MailingCountry?.trim() ?? "") ?? normalizedCountryUsa;
  const state = normalizeUSStateForAddressSafe(patient.MailingState ?? "");
  if (!state) return [];
  const zip = normalizeZipCodeNewSafe(patient.MailingPostalCode ?? "");
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

export function createContacts(patient: EpicPatient): Contact[] {
  const email = patient.Email ? normalizeEmailNewSafe(patient.Email) : undefined;
  const phone = patient.Phone ? normalizePhoneNumberSafe(patient.Phone) : undefined;
  return [
    {
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    },
  ];
}

export function createNames(patient: EpicPatient): { firstName: string; lastName: string } {
  if (!patient.FirstName) throw new BadRequestError("Patient first name is empty");
  const firstName = toTitleCase(patient.FirstName.trim());
  if (firstName === "") throw new BadRequestError("Patient first name is empty");
  if (!patient.LastName) throw new BadRequestError("Patient last name is empty");
  const lastName = toTitleCase(patient.LastName.trim());
  if (lastName === "") throw new BadRequestError("Patient last name is empty");
  return {
    firstName,
    lastName,
  };
}
