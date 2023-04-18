import { Op } from "sequelize";
import NotFoundError from "../../../errors/not-found";
import { FacilityModel } from "../../../models/medical/facility";
import { OrganizationModel } from "../../../models/medical/organization";
import { Patient, PatientModel } from "../../../models/medical/patient";
import { getFacilities } from "../facility/get-facility";
import { getOrganizationOrFail } from "../organization/get-organization";
import { PatientData } from "../../../models/medical/patient";

export const getPatients = async ({
  facilityId,
  cxId,
}: {
  facilityId: string;
  cxId: string;
}): Promise<Patient[]> => {
  const patients = await PatientModel.findAll({
    where: { cxId, facilityIds: [facilityId] },
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
  const patient = await PatientModel.findOne({
    where: {
      cxId,
      facilityIds: [facilityId],
      data: {
        [Op.eq]: demo,
      },
    },
  });

  return patient;
};

export const getPatientOrFail = async ({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<PatientModel> => {
  const patient = await PatientModel.findOne({
    where: { cxId, id },
  });
  if (!patient) throw new NotFoundError(`Could not find patient`);
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
