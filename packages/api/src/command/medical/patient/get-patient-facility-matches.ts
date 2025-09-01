import { CwLinkV2 } from "@metriport/commonwell-sdk";
import { Address } from "@metriport/core/domain/address";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { USState } from "@metriport/shared";
import { CQLink } from "../../../external/carequality/cq-patient-data";
import { CQDirectoryEntryViewModel } from "../../../external/carequality/models/cq-directory-view";
import { CQPatientDataModel } from "../../../external/carequality/models/cq-patient-data";
import { patientResourceToNormalizedLinkDemographics as cqPatientResourceToNormalizedLinkDemographics } from "../../../external/carequality/patient-demographics";
import { patientNetworkLinkToNormalizedLinkDemographics as cwPatientResourceToNormalizedLinkDemographics } from "../../../external/commonwell-v1/patient-demographics";
import { orgDirectory } from "../../../external/commonwell-v2/command/directory/org-directory";
import { networkLinkToLinkDemographics } from "../../../external/commonwell-v2/patient/patient-demographics";
import { NetworkLink } from "../../../external/commonwell-v2/patient/types";
import { CwPatientDataModel } from "../../../external/commonwell/models/cw-patient-data";
import {
  CwLink,
  CwLinkV1,
  isCwLinkV1,
} from "../../../external/commonwell/patient/cw-patient-data/shared";

type PatientFacilityMatch = {
  name?: string;
  oid?: string;
  address: Partial<Address>;
  patient?: LinkDemographics;
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
    const cqFacility = await CQDirectoryEntryViewModel.findOne({
      where: { id: cqLink.oid },
    });

    if (!cqFacility) {
      continue;
    }

    const patientMatchDemo = cqLink.patientResource
      ? cqPatientResourceToNormalizedLinkDemographics(cqLink.patientResource)
      : undefined;

    patientFacilityMatches.push({
      name: cqFacility.name ?? undefined,
      oid: cqFacility.id ?? undefined,
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

async function getCwFacilityMatches(cwLinks: CwLink[]): Promise<PatientFacilityMatch[]> {
  const patientFacilityMatches = cwLinks.reduce((acc: PatientFacilityMatch[], curr) => {
    const isV1 = isCwLinkV1(curr);
    const matchDetails = isV1 ? getMatchDetailsV1(curr) : getMatchDetailsV2(curr);
    if (matchDetails) {
      acc.push(matchDetails);
    }

    return acc;
  }, []);

  return patientFacilityMatches;
}

function getMatchDetailsV1(curr: CwLinkV1): PatientFacilityMatch | undefined {
  const patient = curr.patient;
  const reference = patient?.provider?.reference;
  const splitReference = reference?.split("/");
  const oid = splitReference?.[splitReference.length - 2];
  const display = patient?.provider?.display;

  if (!patient || !oid || !display) {
    return undefined;
  }

  const org = orgDirectory.find(org => org.oid === oid);

  const patientMatchDemo = cwPatientResourceToNormalizedLinkDemographics(patient);

  return {
    name: display,
    oid,
    patient: patientMatchDemo,
    address: {
      state: org?.state as USState | undefined,
      zip: org?.zip,
    },
  };
}

function getMatchDetailsV2(link: CwLinkV2): PatientFacilityMatch | undefined {
  const patient = link.Patient;
  const oid = patient?.managingOrganization?.identifier[0]?.system;
  const display = patient?.managingOrganization?.name;

  if (!patient || !oid || !display) {
    return undefined;
  }

  const org = orgDirectory.find(org => org.oid === oid);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { version, ...rest } = link;
  const patientMatchDemo = networkLinkToLinkDemographics({
    ...rest,
    type: "probable",
  } as NetworkLink);

  return {
    name: display,
    oid,
    patient: patientMatchDemo,
    address: {
      state: org?.state as USState | undefined,
      zip: org?.zip,
    },
  };
}
