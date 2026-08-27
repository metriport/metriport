import { CwLinkV2 } from "@metriport/commonwell-sdk";
import { Address } from "@metriport/core/domain/address";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { USState } from "@metriport/shared";
import { CQLink } from "../../../external/carequality/cq-patient-data";
import { CQDirectoryEntryViewModel } from "../../../external/carequality/models/cq-directory-view";
import { CQPatientDataModel } from "../../../external/carequality/models/cq-patient-data";
import { patientResourceToNormalizedLinkDemographics as cqPatientResourceToNormalizedLinkDemographics } from "../../../external/carequality/patient-demographics";
import { networkLinkToLinkDemographics } from "../../../external/commonwell-v2/patient/patient-demographics";
import { NetworkLink } from "../../../external/commonwell-v2/patient/types";
import { patientNetworkLinkToNormalizedLinkDemographics as cwPatientResourceToNormalizedLinkDemographics } from "../../../external/commonwell/links/v1/patient-demographics";
import { CwDirectoryEntryViewModel } from "../../../external/commonwell/models/cw-directory-view";
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
  const patientFacilityMatches: PatientFacilityMatch[] = [];

  for (const cwLink of cwLinks) {
    const isV1 = isCwLinkV1(cwLink);
    const matchDetails = isV1 ? await getMatchDetailsV1(cwLink) : await getMatchDetailsV2(cwLink);
    if (matchDetails) {
      patientFacilityMatches.push(matchDetails);
    }
  }

  return patientFacilityMatches;
}

async function getMatchDetailsV1(curr: CwLinkV1): Promise<PatientFacilityMatch | undefined> {
  const patient = curr.patient;
  const reference = patient?.provider?.reference;
  const splitReference = reference?.split("/");
  const oid = splitReference?.[splitReference.length - 2];
  const display = patient?.provider?.display;

  if (!patient || !oid || !display) {
    return undefined;
  }

  const cwFacility = await CwDirectoryEntryViewModel.findOne({
    where: { oid },
  });

  if (!cwFacility) {
    return undefined;
  }

  const patientMatchDemo = cwPatientResourceToNormalizedLinkDemographics(patient);

  return {
    name: display,
    oid,
    patient: patientMatchDemo,
    address: {
      addressLine1: cwFacility.addressLine ?? undefined,
      city: cwFacility.city ?? undefined,
      state:
        cwFacility.state && Object.values(USState).includes(cwFacility.state as USState)
          ? (cwFacility.state as USState)
          : undefined,
      zip: cwFacility.zip ?? undefined,
    },
  };
}

async function getMatchDetailsV2(link: CwLinkV2): Promise<PatientFacilityMatch | undefined> {
  const patient = link.Patient;
  const oid = patient?.managingOrganization?.identifier[0]?.system;
  const display = patient?.managingOrganization?.name;

  if (!patient || !oid || !display) {
    return undefined;
  }

  const cwFacility = await CwDirectoryEntryViewModel.findOne({
    where: { oid },
  });

  if (!cwFacility) {
    return undefined;
  }

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
      addressLine1: cwFacility.addressLine ?? undefined,
      city: cwFacility.city ?? undefined,
      state:
        cwFacility.state && Object.values(USState).includes(cwFacility.state as USState)
          ? (cwFacility.state as USState)
          : undefined,
      zip: cwFacility.zip ?? undefined,
    },
  };
}
