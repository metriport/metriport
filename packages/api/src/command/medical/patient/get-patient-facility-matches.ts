import { Address } from "@metriport/core/domain/address";
import { USState } from "@metriport/api-sdk";
import { PatientNetworkLink } from "@metriport/commonwell-sdk";
import { ISO_DATE } from "@metriport/shared/common/date";
import { toTitleCase } from "@metriport/shared/common/string";
import dayjs from "dayjs";
import { PatientResource } from "@metriport/ihe-gateway-sdk";
import { CQLink } from "../../../external/carequality/cq-patient-data";
import { CwLink } from "../../../external/commonwell/cw-patient-data";
import { CQPatientDataModel } from "../../../external/carequality/models/cq-patient-data";
import { CwPatientDataModel } from "../../../external/commonwell/models/cw-patient-data";
import { CQDirectoryEntryModel } from "../../../external/carequality/models/cq-directory";
import { orgDirectory } from "../../../external/commonwell/org-directory";
import { mapGenderAtBirthFromCw } from "../../../external/commonwell/patient-conversion";
import { mapGenderAtBirthFromCq } from "../../../external/carequality/patient-demographics";
import { getCwPatientContactType } from "../../../external/commonwell/shared";
import { getCqPatientContactType } from "../../../external/carequality/shared";

type PatientFacilityMatch = {
  name: string;
  oid: string;
  address: Partial<Address>;
  patient?: PatientFacilityMatchDemo;
};

type PatientFacilityMatchDemo = {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  address: Partial<Address>[];
  emails?: string[];
  phones?: string[];
};

export async function getPatientFacilityMatches({
  patientId,
}: {
  patientId: string;
}): Promise<PatientFacilityMatch[]> {
  const [cqPatientData, cwPatientData] = await Promise.all([
    CQPatientDataModel.findOne({ where: { id: patientId } }),
    CwPatientDataModel.findOne({ where: { id: patientId } }),
  ]);

  const cqPatientDataLinks = cqPatientData?.data.links ?? [];
  const cwPatientDataLinks = cwPatientData?.data.links ?? [];

  const [cqPatientFacilityMatches, cwPatientFacilityMatches] = await Promise.all([
    getCqFacilityMatches(cqPatientDataLinks),
    getCwFacilityMatches(cwPatientDataLinks),
  ]);

  return [...cqPatientFacilityMatches, ...cwPatientFacilityMatches];
}

async function getCqFacilityMatches(cqLinks: CQLink[]): Promise<PatientFacilityMatch[]> {
  const patientFacilityMatches: PatientFacilityMatch[] = [];

  for (const cqLink of cqLinks) {
    if (!cqLink.patientResource) {
      continue;
    }

    const cqFacility = await CQDirectoryEntryModel.findOne({
      where: { id: cqLink.oid },
    });

    if (!cqFacility) {
      continue;
    }

    const patientMatchDemo = cqPatientToPatientMatch(cqLink.patientResource);

    patientFacilityMatches.push({
      name: cqFacility.name ?? "",
      oid: cqFacility.id ?? "",
      address: {
        addressLine1: cqFacility.addressLine ?? undefined,
        city: cqFacility.city ?? undefined,
        state: (cqFacility.state as USState) ?? undefined,
        zip: cqFacility.zip ?? undefined,
      },
      patient: patientMatchDemo,
    });
  }

  return patientFacilityMatches;
}

function cqPatientToPatientMatch(patient: PatientResource): PatientFacilityMatchDemo {
  const givenNames = patient.name[0].given;
  const firstName = givenNames.join(" ");

  const familyName = patient.name[0].family;

  const address = patient.address?.map(addr => ({
    addressLine1: addr.line?.[0],
    addressLine2: addr.line?.[1],
    city: addr.city,
    state: addr.state as USState,
    zip: addr.postalCode,
    country: addr.country,
  }));

  const emails = getCqPatientContactType(patient.telecom, "email");
  const phones = getCqPatientContactType(patient.telecom, "phone");

  return {
    firstName: toTitleCase(firstName),
    lastName: toTitleCase(familyName),
    gender: mapGenderAtBirthFromCq(patient.gender),
    dob: dayjs(patient.birthDate).format(ISO_DATE),
    address: address ?? [],
    emails,
    phones,
  };
}

async function getCwFacilityMatches(cwLinks: CwLink[]): Promise<PatientFacilityMatch[]> {
  const patientFacilityMatches = cwLinks.reduce((acc: PatientFacilityMatch[], curr) => {
    const patient = curr.patient;
    const reference = patient?.provider?.reference;
    const splitReference = reference?.split("/");
    const oid = splitReference?.[splitReference.length - 2];
    const display = patient?.provider?.display;

    if (!patient || !oid || !display) {
      return acc;
    }

    const org = orgDirectory.find(org => org.oid === oid);

    const patientMatchDemo = cwPatientToPatientMatch(patient);

    acc.push({
      name: display,
      oid,
      patient: patientMatchDemo,
      address: {
        state: org?.state as USState,
        zip: org?.zip,
      },
    });

    return acc;
  }, []);

  return patientFacilityMatches;
}

function cwPatientToPatientMatch(patient: PatientNetworkLink): PatientFacilityMatchDemo {
  const givenNames = patient.details?.name[0].given;
  const firstName = givenNames?.join(" ");

  const familyName = patient.details.name[0].family;
  const lastName = familyName.join(" ");

  const address = patient.details.address.map(addr => ({
    addressLine1: addr.line?.[0] ?? undefined,
    addressLine2: addr.line?.[1] ?? undefined,
    city: addr.city ?? undefined,
    state: addr.state as USState,
    zip: addr.zip ?? undefined,
    country: addr.country ?? undefined,
  }));

  const emails = getCwPatientContactType(patient.details.telecom, "email");
  const phones = getCwPatientContactType(patient.details.telecom, "phone");

  return {
    firstName: firstName ? toTitleCase(firstName) : "",
    lastName: toTitleCase(lastName),
    gender: patient.details.gender.display
      ? mapGenderAtBirthFromCw(patient.details.gender.code)
      : "UN",
    dob: dayjs(patient.details.birthDate).format(ISO_DATE),
    address,
    emails,
    phones,
  };
}
