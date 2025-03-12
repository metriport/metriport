import { Address } from "@metriport/core/domain/address";
import { Contact } from "@metriport/core/domain/contact";
import { PatientDemoData } from "@metriport/core/domain/patient";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import {
  BadRequestError,
  errorToString,
  MetriportError,
  normalizeCountrySafe,
  normalizedCountryUsa,
  normalizeDob,
  normalizeEmailNewSafe,
  normalizeGender,
  normalizePhoneNumberSafe,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
  toTitleCase,
} from "@metriport/shared";
import { Patient } from "@metriport/shared/interface/external/ehr/patient";
import {
  getPatientByDemo,
  PatientWithIdentifiers,
} from "../../command/medical/patient/get-patient";
import { handleMetriportSync, HandleMetriportSyncParams } from "./patient";

const parallelPatientMatches = 5;

type GetPatientByDemoParams = {
  cxId: string;
  demo: PatientDemoData;
};

export function createContactsFromFhir(patient: Patient): Contact[] {
  return (patient.telecom ?? []).flatMap(telecom => {
    if (telecom.system === "email") {
      if (!telecom.value) return [];
      const email = normalizeEmailNewSafe(telecom.value);
      if (!email) return [];
      return { email };
    } else if (telecom.system === "phone") {
      if (!telecom.value) return [];
      const phone = normalizePhoneNumberSafe(telecom.value);
      if (!phone) return [];
      return { phone };
    }
    return [];
  });
}

export function createAddressesFromFhir(patient: Patient): Address[] {
  if (!patient.address) throw new BadRequestError("Patient has no address");
  const addresses = patient.address.flatMap(address => {
    if (!address.line || address.line.length === 0) return [];
    const addressLine1 = (address.line[0] as string).trim();
    if (addressLine1 === "") return [];
    const addressLines2plus = address.line
      .slice(1)
      .map(l => l.trim())
      .filter(l => l !== "");
    if (!address.city) return [];
    const city = address.city.trim();
    if (city === "") return [];
    if (!address.country) return [];
    const country = normalizeCountrySafe(address.country) ?? normalizedCountryUsa;
    if (!address.state) return [];
    const state = normalizeUSStateForAddressSafe(address.state);
    if (!state) return [];
    if (!address.postalCode) return [];
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
  if (addresses.length === 0) {
    throw new BadRequestError("Patient has no valid addresses", undefined, {
      addresses: patient.address.map(a => JSON.stringify(a)).join(","),
    });
  }
  return addresses;
}

export function createNamesFromFhir(patient: Patient): { firstName: string; lastName: string }[] {
  if (!patient.name) throw new BadRequestError("Patient has no name");
  const names = patient.name.flatMap(name => {
    if (!name.family) return [];
    const lastName = name.family.trim();
    if (lastName === "") return [];
    if (!name.given) return [];
    return name.given.flatMap(gName => {
      const firstName = gName.trim();
      if (firstName === "") return [];
      return [{ firstName: toTitleCase(firstName), lastName: toTitleCase(lastName) }];
    });
  });
  if (names.length === 0) {
    throw new BadRequestError("Patient has no valid names", undefined, {
      names: patient.name.map(n => JSON.stringify(n)).join(","),
    });
  }
  return names;
}

export function createMetriportPatientDemosFhir(patient: Patient): PatientDemoData[] {
  const dob = normalizeDob(patient.birthDate);
  const genderAtBirth = normalizeGender(patient.gender);
  const addressArray = createAddressesFromFhir(patient);
  const contactArray = createContactsFromFhir(patient);
  const namesArray = createNamesFromFhir(patient);
  return namesArray.map(n => {
    return {
      firstName: n.firstName,
      lastName: n.lastName,
      dob,
      genderAtBirth,
      address: addressArray,
      contact: contactArray,
    };
  });
}

export function collapsePatientDemosFhir(demos: PatientDemoData[]): PatientDemoData {
  const firstDemo = demos[0];
  if (!firstDemo) throw new MetriportError("No patient demos to collapse");
  return demos.slice(1).reduce((acc: PatientDemoData, demo) => {
    return {
      ...acc,
      firstName: acc.firstName.includes(demo.firstName)
        ? acc.firstName
        : `${acc.firstName} ${demo.firstName}`,
      lastName: acc.lastName.includes(demo.lastName)
        ? acc.lastName
        : `${acc.lastName} ${demo.lastName}`,
    };
  }, firstDemo);
}

export async function getOrCreateMetriportPatientFhir({
  cxId,
  source,
  practiceId,
  externalId,
  possibleDemographics,
}: Omit<HandleMetriportSyncParams, "demographics"> & {
  possibleDemographics: PatientDemoData[];
}): Promise<PatientWithIdentifiers> {
  const patients: PatientWithIdentifiers[] = [];
  const getPatientByDemoErrors: { error: unknown; cxId: string; demos: string }[] = [];
  const getPatientByDemoArgs: GetPatientByDemoParams[] = possibleDemographics.map(demo => {
    return { cxId, demo };
  });

  await executeAsynchronously(
    getPatientByDemoArgs,
    async (params: GetPatientByDemoParams) => {
      const { log } = out(`${source} getPatientByDemo - cxId ${cxId}`);
      try {
        const patient = await getPatientByDemo(params);
        if (patient) patients.push(patient);
      } catch (error) {
        const demosToString = JSON.stringify(params.demo);
        log(
          `Failed to get patient by demo for demos ${demosToString}. Cause: ${errorToString(error)}`
        );
        getPatientByDemoErrors.push({ error, ...params, demos: demosToString });
      }
    },
    { numberOfParallelExecutions: parallelPatientMatches }
  );

  if (getPatientByDemoErrors.length > 0) {
    const msg = `Failed to get patient by some demos @ ${source}`;
    capture.message(msg, {
      extra: {
        cxId,
        source,
        practiceId,
        externalId,
        getPatientByDemoArgsCount: getPatientByDemoArgs.length,
        errorCount: getPatientByDemoErrors.length,
        errors: getPatientByDemoErrors,
        context: `${source}.get-metriport-patient-fhir`,
      },
      level: "warning",
    });
  }

  const metriportPatient = patients[0];
  if (metriportPatient) {
    const uniquePatientIds = new Set(patients.map(patient => patient.id));
    if (uniquePatientIds.size > 1) {
      capture.message(`${source} patient mapping to more than one Metriport patient`, {
        extra: {
          cxId,
          practiceId,
          externalId,
          metriportPatientIds: uniquePatientIds,
          context: `${source}.get-metriport-patient-fhir`,
        },
        level: "warning",
      });
    }
    return metriportPatient;
  } else {
    return await handleMetriportSync({
      cxId,
      source,
      practiceId,
      demographics: collapsePatientDemosFhir(possibleDemographics),
      externalId,
    });
  }
}
