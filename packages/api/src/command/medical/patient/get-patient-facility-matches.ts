import { Address } from "@metriport/core/domain/address";
import { USState } from "@metriport/api-sdk";
import { PatientNetworkLink } from "@metriport/commonwell-sdk";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { PatientResource } from "@metriport/ihe-gateway-sdk";
import { CQLink } from "../../../external/carequality/cq-patient-data";
import { CwLink } from "../../../external/commonwell/cw-patient-data";
import { CQPatientDataModel } from "../../../external/carequality/models/cq-patient-data";
import { CwPatientDataModel } from "../../../external/commonwell/models/cw-patient-data";
import { CQDirectoryEntryModel } from "../../../external/carequality/models/cq-directory";
import { orgDirectory } from "../../../external/commonwell/org-directory";

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

  const cqPatientFacilityMatches = await getCqFacilityMatches(cqPatientDataLinks);
  const cwPatientFacilityMatches = await getCwFacilityMatches(cwPatientDataLinks);

  return [...cqPatientFacilityMatches, ...cwPatientFacilityMatches];
}

async function getCqFacilityMatches(cqLinks: CQLink[]): Promise<PatientFacilityMatch[]> {
  const patientFacilityMatches: PatientFacilityMatch[] = [];

  for (const cqLink of cqLinks) {
    const cqFacility = await CQDirectoryEntryModel.findOne({
      where: { id: cqLink.oid },
    });

    if (!cqLink.patientResource) {
      continue;
    }

    const patientMatchDemo = cqPatientToPatientMatch(cqLink.patientResource);

    if (cqFacility) {
      patientFacilityMatches.push({
        name: cqFacility.name ?? "",
        oid: cqFacility.id ?? "",
        address: {
          addressLine1: cqFacility.addressLine ?? undefined,
          city: cqFacility.city ?? undefined,
          state: cqFacility.state as USState,
          zip: cqFacility.zip ?? undefined,
        },
        patient: patientMatchDemo,
      });
    }
  }

  return patientFacilityMatches;
}

function cqPatientToPatientMatch(patient: PatientResource): PatientFacilityMatchDemo {
  const givenNames = patient.name[0].given;
  const firstName = givenNames?.join(" ") ?? "";

  const familyName = patient.name[0].family;

  const address = patient.address?.map(addr => ({
    addressLine1: addr.line?.[0] ?? undefined,
    addressLine2: addr.line?.[1] ?? undefined,
    city: addr.city ?? undefined,
    state: addr.state as USState,
    zip: addr.postalCode ?? undefined,
    country: addr.country ?? undefined,
  }));

  const emails = patient.telecom?.reduce((acc: string[], curr) => {
    if (curr.system === "email" && curr.value) {
      acc.push(curr.value);
    }
    return acc;
  }, []);

  const phones = patient.telecom?.reduce((acc: string[], curr) => {
    if (curr.system === "phone" && curr.value) {
      acc.push(curr.value);
    }
    return acc;
  }, []);

  return {
    firstName: toTitleCase(firstName),
    lastName: toTitleCase(familyName),
    gender: toTitleCase(patient.gender),
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

    if (!patient) {
      return acc;
    }

    const org = orgDirectory.find(org => org.oid === oid);

    const patientMatchDemo = cwPatientToPatientMatch(patient);

    if (oid && display) {
      acc.push({
        name: display,
        oid,
        patient: patientMatchDemo,
        address: {
          state: org?.state as USState,
          zip: org?.zip ?? undefined,
        },
      });
    }

    return acc;
  }, []);

  return patientFacilityMatches;
}

function cwPatientToPatientMatch(patient: PatientNetworkLink): PatientFacilityMatchDemo {
  const givenNames = patient.details?.name[0].given;
  const firstName = givenNames?.join(" ") ?? "";

  const familyName = patient.details.name[0].family;
  const lastName = familyName.join(" ") ?? "";

  const address = patient.details.address.map(addr => ({
    addressLine1: addr.line?.[0] ?? undefined,
    addressLine2: addr.line?.[1] ?? undefined,
    city: addr.city ?? undefined,
    state: addr.state as USState,
    zip: addr.zip ?? undefined,
    country: addr.country ?? undefined,
  }));

  const emails = patient.details.telecom?.reduce((acc: string[], curr) => {
    if (curr.system === "email" && curr.value) {
      acc.push(curr.value);
    }
    return acc;
  }, []);

  const phones = patient.details.telecom?.reduce((acc: string[], curr) => {
    if (curr.system === "phone" && curr.value) {
      acc.push(curr.value);
    }
    return acc;
  }, []);

  return {
    firstName: toTitleCase(firstName),
    lastName: toTitleCase(lastName),
    gender: patient.details.gender.display ? toTitleCase(patient.details.gender.display) : "UN",
    dob: dayjs(patient.details.birthDate).format(ISO_DATE),
    address,
    emails,
    phones,
  };
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(s => s.charAt(0).toUpperCase() + s.substring(1))
    .join(" ")
    .trim();
}
