import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { isHealthcareItVendor } from "@metriport/core/domain/organization";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { isFacilityActiveForHie, Facility } from "../../domain/medical/facility";
import { getPatientWithDependencies } from "../../command/medical/patient/get-patient";

export type HieInitiator = {
  oid: string;
  name: string;
  npi: string;
  facilityId: string;
  orgName: string;
};

export async function getHieInitiator(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId: string | undefined
): Promise<HieInitiator> {
  const { organization, facilities } = await getPatientWithDependencies(patient);
  const facility = getPatientsFacility(patient.id, facilities, facilityId);

  if (isHealthcareItVendor(organization.type)) {
    return {
      oid: facility.oid,
      name: facility.data.name,
      npi: facility.data.npi,
      facilityId: facility.id,
      orgName: organization.data.name,
    };
  }
  return {
    oid: organization.oid,
    name: organization.data.name,
    npi: facility.data.npi,
    facilityId: facility.id,
    orgName: organization.data.name,
  };
}

export async function isHieEnabledToQuery(
  facilityId: string | undefined,
  patient: Pick<Patient, "id" | "cxId">,
  hie: MedicalDataSource.COMMONWELL | MedicalDataSource.CAREQUALITY
): Promise<boolean> {
  const { organization, facilities } = await getPatientWithDependencies(patient);

  const facility = getPatientsFacility(patient.id, facilities, facilityId);

  if (isHealthcareItVendor(organization.type)) {
    if (!isFacilityActiveForHie(facility, hie)) {
      return false;
    }
  }

  return true;
}

export function getPatientsFacility(
  patientId: string,
  facilities: Facility[],
  facilityId: string | undefined
): Facility {
  if (!facilityId && facilities.length > 1) {
    throw new MetriportError(
      `Patient has more than one facility, facilityId is required`,
      undefined,
      {
        patientId: patientId,
        facilities: facilities.length,
      }
    );
  }
  const facility = facilityId ? facilities.find(f => f.id === facilityId) : facilities[0];
  if (!facility) {
    if (facilityId) {
      throw new MetriportError(`Patient not associated with given facility`, undefined, {
        patientId: patientId,
        facilityId,
      });
    }
    throw new MetriportError(`Could not determine facility for patient`, undefined, {
      patientId: patientId,
    });
  }

  return facility;
}
