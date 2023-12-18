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
import { matchPatients, jaroWinklerSimilarity } from "./match-patient";
import { blockPatients } from "./block-patients";
import { normalizePatientData } from "./normalize-patient";
import { mergePatients, mergeWithFirstPatient } from "./merge-patients";

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

export const getPatientByDemo = async ({
  facilityId,
  cxId,
  demo,
}: {
  facilityId: string;
  cxId: string;
  demo: PatientData;
}): Promise<Patient | null> => {
  // TODO this normalization should not be rollled out until we do a migration to normalize all existing patients.
  // A null normalizaed patient means that the patient demographics included default values.
  const normalizedPatientDemo = normalizePatientData(demo);
  if (!normalizedPatientDemo) return null;

  // TODO this might be bad form to use PatientCreate for this. Also because
  const blockedPatients = await blockPatients({
    cxId: cxId,
    facilityIds: [facilityId],
    data: {
      dob: normalizedPatientDemo.dob,
      genderAtBirth: normalizedPatientDemo.genderAtBirth,
    },
  });
  console.log("blockedPatients", blockedPatients);

  const matchingPatients = matchPatients(
    jaroWinklerSimilarity,
    blockedPatients,
    normalizedPatientDemo,
    SIMILARITY_THRESHOLD
  );
  return mergePatients(mergeWithFirstPatient, matchingPatients, normalizedPatientDemo, cxId);
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
