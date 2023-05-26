import { intersectionWith, isEqual } from "lodash";
import { Op, Transaction } from "sequelize";
import NotFoundError from "../../../errors/not-found";
import { FacilityModel } from "../../../models/medical/facility";
import { OrganizationModel } from "../../../models/medical/organization";
import { Patient, PatientData, PatientModel } from "../../../models/medical/patient";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getFacilities } from "../facility/get-facility";
import { getOrganizationOrFail } from "../organization/get-organization";

export const getPatients = async ({
  facilityId,
  cxId,
}: {
  facilityId?: string;
  cxId: string;
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
    },
    order: [["id", "ASC"]],
  });
  return patients;
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
  const { log } = Util.out(`getPatientByDemo - cxId ${cxId}`);

  const patients = await PatientModel.findAll({
    where: {
      cxId,
      facilityIds: {
        [Op.contains]: [facilityId],
      },
      data: {
        dob: demo.dob,
        genderAtBirth: demo.genderAtBirth,
      },
    },
  });

  // TODO: #656 Check for personal identifiers & demo in memory, we were having a hard time to get the query to work with Sequelize
  // Consider checking this out if trying to move this to the query: https://github.com/sequelize/sequelize/issues/5173
  const matchingPatients = patients.filter(patient => {
    // First, check for an ID match - if it's a match, don't bother checking for demo
    if (
      demo.personalIdentifiers &&
      demo.personalIdentifiers.length > 0 &&
      intersectionWith(patient.data.personalIdentifiers, demo.personalIdentifiers, isEqual).length >
        0
    ) {
      return true;
    }
    // If the IDs don't match, or none were provided, check the demo for a match
    let demoMatch =
      intersectionWith(patient.data.firstName, demo.firstName, isEqual).length > 0 &&
      intersectionWith(patient.data.lastName, demo.lastName, isEqual).length > 0 &&
      intersectionWith(patient.data.address, demo.address, isEqual).length > 0;
    if (demoMatch && demo.contact && demo.contact.length > 0) {
      demoMatch = intersectionWith(patient.data.contact, demo.contact, isEqual).length > 0;
    }
    return demoMatch;
  });
  if (matchingPatients.length === 0) return null;
  if (matchingPatients.length === 1) return matchingPatients[0];

  const chosenOne = matchingPatients[0];

  const msg = `Found more than one patient with the same demo`;
  log(
    `${msg}, chose ${chosenOne.id} - list ${matchingPatients.map(p => p.id).join(", ")} - demo: `,
    demo
  );
  capture.message(msg, {
    extra: {
      chosenOne: chosenOne.id,
      demographics: demo,
      patients: matchingPatients.map(p => ({ id: p.id, data: p.data })),
    },
  });

  return chosenOne;
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
