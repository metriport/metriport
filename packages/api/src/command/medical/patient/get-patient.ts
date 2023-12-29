import { USState } from "@metriport/core/domain/geographic-locations";
import { uniq } from "lodash";
import { Op, Transaction } from "sequelize";
import { getStatesFromAddresses, Patient, PatientData } from "../../../domain/medical/patient";
import NotFoundError from "../../../errors/not-found";
import { FacilityModel } from "../../../models/medical/facility";
import { OrganizationModel } from "../../../models/medical/organization";
import { PatientModel } from "../../../models/medical/patient";
import { getFacilities } from "../facility/get-facility";
import { getOrganizationOrFail } from "../organization/get-organization";
import {
  matchPatients,
  jaroWinklerSimilarity,
  matchingPersonalIdentifiersRule,
  matchingContactDetailsRule,
} from "@metriport/core/mpi/match-patients";
import { normalizePatient } from "@metriport/core/mpi/normalize-patient";
import { mergeWithFirstPatient } from "@metriport/core/mpi/merge-patients";
import { PatientFinderLocal } from "./patient-finder-local";
import { convertPatientDataToPatientDataMPI } from "./convert-patients";

const SIMILARITY_THRESHOLD = 0.96;

export const getPatients = async ({
  facilityId,
  cxId,
  patientIds,
}: {
  facilityId?: string;
  cxId: string;
  patientIds?: string[];
}): Promise<Patient[]> => {
  const patients = await PatientModel.findAll({
    where: {
      cxId,
      ...(facilityId
        ? {
            facilityIds: {
              [Op.contains]: [facilityId],
            },
          }
        : undefined),
      ...(patientIds ? { id: patientIds } : undefined),
    },
    order: [["id", "ASC"]],
  });
  return patients;
};

export const getPatientIds = async ({
  facilityId,
  cxId,
}: {
  facilityId?: string;
  cxId: string;
}): Promise<string[]> => {
  const patients = await PatientModel.findAll({
    attributes: ["id"],
    where: {
      cxId,
      ...(facilityId
        ? {
            facilityIds: {
              [Op.contains]: [facilityId],
            },
          }
        : undefined),
    },
  });
  return patients.map(p => p.id);
};

/**
 * Retrieves a patient based on their demographic information. Utilizes functions
 * imported from the MPI core module: normalization, finding(blocking), matching, merging
 * @param facilityId - The ID of the facility where the patient is associated.
 * @param cxId - The ID of the patient in the external system.
 * @param demo - The demographic information of the patient.
 * @returns The matched patient object if found, otherwise undefined.
 */
export const getPatientByDemo = async ({
  cxId,
  demo,
}: {
  cxId: string;
  demo: PatientData;
}): Promise<Patient | undefined> => {
  // Normalize the patient demographic data
  const normalizedPatientDemo = normalizePatient(convertPatientDataToPatientDataMPI(demo));
  if (!normalizedPatientDemo) {
    return undefined;
  }

  // Find patients based on the criteria of matching dob and genderAtBirth
  const patientFinder = new PatientFinderLocal();
  const foundPatients = await patientFinder.find({
    cxId,
    data: {
      dob: normalizedPatientDemo.dob,
      genderAtBirth: normalizedPatientDemo.genderAtBirth,
    },
  });

  // Convert patients to proper datatype
  // Match the found patients with the normalized patient using the similarity function
  const matchingPatients = matchPatients(
    jaroWinklerSimilarity,
    [matchingPersonalIdentifiersRule, matchingContactDetailsRule],
    foundPatients,
    normalizedPatientDemo,
    SIMILARITY_THRESHOLD
  );

  // Merge the matching patients
  const mpiPatient = mergeWithFirstPatient(matchingPatients, normalizedPatientDemo, cxId);

  if (!mpiPatient) {
    return undefined;
  }

  return getPatientOrFail({ id: mpiPatient.id, cxId });
};

export type GetPatient = {
  id: string;
  cxId: string;
} & (
  | {
      transaction?: never;
      lock?: never;
    }
  | {
      transaction: Transaction;
      lock?: boolean;
    }
);

/**
 * @see executeOnDBTx() for details about the 'transaction' and 'lock' parameters.
 */
export const getPatient = async ({
  id,
  cxId,
  transaction,
  lock,
}: GetPatient): Promise<PatientModel | undefined> => {
  const patient = await PatientModel.findOne({
    where: { cxId, id },
    transaction,
    lock,
  });
  return patient ?? undefined;
};

/**
 * @see executeOnDBTx() for details about the 'transaction' and 'lock' parameters.
 */
export const getPatientOrFail = async (params: GetPatient): Promise<PatientModel> => {
  const patient = await getPatient(params);
  if (!patient) throw new NotFoundError(`Could not find patient`, undefined, { id: params.id });
  return patient;
};

export const getPatientWithDependencies = async ({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<{
  patient: PatientModel;
  facilities: FacilityModel[];
  organization: OrganizationModel;
}> => {
  const patient = await getPatientOrFail({ id, cxId });
  const facilities = await getFacilities({ cxId, ids: patient.facilityIds });
  const organization = await getOrganizationOrFail({ cxId });
  return { patient, facilities, organization };
};

export const getPatientStates = async ({
  cxId,
  patientIds,
}: {
  cxId: string;
  patientIds: string[];
}): Promise<USState[]> => {
  if (!patientIds || !patientIds.length) return [];
  const patients = await getPatients({ cxId, patientIds });
  const nonUniqueStates = patients.flatMap(getStatesFromAddresses).filter(s => s);
  return uniq(nonUniqueStates);
};
