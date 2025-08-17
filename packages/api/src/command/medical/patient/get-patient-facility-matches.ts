import { USState } from "@metriport/shared";
import { Address } from "@metriport/core/domain/address";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { CQLink } from "../../../external/carequality/cq-patient-data";
import { CwLink } from "../../../external/commonwell/cw-patient-data";
import { CQPatientDataModel } from "../../../external/carequality/models/cq-patient-data";
import { CwPatientDataModel } from "../../../external/commonwell/models/cw-patient-data";
import { CQDirectoryEntryViewModel } from "../../../external/carequality/models/cq-directory-view";
import { orgDirectory } from "../../../external/commonwell/org-directory";
import { patientResourceToNormalizedLinkDemographics as cqPatientResourceToNormalizedLinkDemographics } from "../../../external/carequality/patient-demographics";
import { patientNetworkLinkToNormalizedLinkDemographics as cwPatientResourceToNormalizedLinkDemographics } from "../../../external/commonwell/patient-demographics";

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
    const patient = curr.patient;
    const reference = patient?.provider?.reference;
    const splitReference = reference?.split("/");
    const oid = splitReference?.[splitReference.length - 2];
    const display = patient?.provider?.display;

    if (!patient || !oid || !display) {
      return acc;
    }

    const org = orgDirectory.find(org => org.oid === oid);

    const patientMatchDemo = cwPatientResourceToNormalizedLinkDemographics(patient);

    acc.push({
      name: display,
      oid,
      patient: patientMatchDemo,
      address: {
        state: org?.state as USState | undefined,
        zip: org?.zip,
      },
    });

    return acc;
  }, []);

  return patientFacilityMatches;
}
