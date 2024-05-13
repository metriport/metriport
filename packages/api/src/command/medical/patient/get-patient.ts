import { USState } from "@metriport/core/domain/geographic-locations";
import { Organization } from "@metriport/core/domain/organization";
import { getStatesFromAddresses, Patient, PatientDemoData } from "@metriport/core/domain/patient";
import { getPatientByDemo as getPatientByDemoMPI } from "@metriport/core/mpi/get-patient-by-demo";
import { uniq } from "lodash";
import { Op, Transaction } from "sequelize";
import { Facility } from "../../../domain/medical/facility";
import NotFoundError from "../../../errors/not-found";
import { PatientLoaderLocal } from "../../../external/commonwell/patient-loader-local";
import { PatientModel } from "../../../models/medical/patient";
import { getFacilities } from "../facility/get-facility";
import { getOrganizationOrFail } from "../organization/get-organization";
import { sanitize, validate } from "./shared";

export type PatientSearchCmd = PatientDemoData & { cxId: string };

export async function searchPatient(patient: PatientSearchCmd): Promise<Patient | undefined> {
  const { cxId } = patient;

  const sanitized = sanitize(patient);
  validate(sanitized);
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    sanitized;
  const demo: PatientDemoData = {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
  };

  return await getPatientByDemo({ cxId, demo });
}

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
 * @param cxId - The ID of the patient in the external system.
 * @param demo - The demographic information of the patient.
 * @returns The matched patient object if found, otherwise undefined.
 */
export const getPatientByDemo = async ({
  cxId,
  demo,
}: {
  cxId: string;
  demo: PatientDemoData;
}): Promise<Patient | undefined> => {
  const patientLoader = new PatientLoaderLocal();
  return getPatientByDemoMPI({ cxId, demo, patientLoader });
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

export async function getPatientWithDependencies({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<{
  patient: Patient;
  facilities: Facility[];
  organization: Organization;
}> {
  const patient = await getPatientOrFail({ id, cxId });
  const facilities = await getFacilities({ cxId, ids: patient.facilityIds });
  const organization = await getOrganizationOrFail({ cxId });
  return { patient, facilities, organization };
}

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
