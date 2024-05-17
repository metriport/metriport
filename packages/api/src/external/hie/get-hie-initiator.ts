import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { isOboEnabled, isNonOboFacility } from "../../domain/medical/facility";
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
  facilityId: string | undefined,
  // had to specify them instead of using the type because of the item ALL
  hie: MedicalDataSource.COMMONWELL | MedicalDataSource.CAREQUALITY
): Promise<HieInitiator> {
  const { organization, facilities } = await getPatientWithDependencies(patient);
  if (!facilityId && facilities.length > 1) {
    throw new MetriportError(
      `Patient has more than one facility, facilityId is required`,
      undefined,
      {
        patientId: patient.id,
        facilities: facilities.length,
      }
    );
  }
  const facility = facilityId ? facilities.find(f => f.id === facilityId) : facilities[0];
  if (!facility) {
    if (facilityId) {
      throw new MetriportError(`Patient not associated with given facility`, undefined, {
        patientId: patient.id,
        facilityId,
      });
    }
    throw new MetriportError(`Could not determine facility for patient`, undefined, {
      patientId: patient.id,
    });
  }
  if (isOboEnabled(facility, hie) || isNonOboFacility(facility.type)) {
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
