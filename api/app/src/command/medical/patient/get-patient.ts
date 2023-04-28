import { intersectionWith, isEqual } from "lodash";
import { Op } from "sequelize";
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
  facilityId: string;
  cxId: string;
}): Promise<Patient[]> => {
  const patients = await PatientModel.findAll({
    where: {
      cxId,
      facilityIds: {
        [Op.contains]: [facilityId],
      },
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
        firstName: demo.firstName,
        lastName: demo.lastName,
        dob: demo.dob,
        address: {
          addressLine1: demo.address.addressLine1,
          city: demo.address.city,
          state: demo.address.state,
          zip: demo.address.zip,
          country: demo.address.country,
          ...(demo.address.addressLine2 ? { addressLine2: demo.address.addressLine2 } : undefined),
        },
        contact: demo.contact,
      },
    },
  });

  // Check for personal identifiers in memory, we were having a hard time to get the query to work with Sequelize
  // Consider checking this out if trying to move this to the query: https://github.com/sequelize/sequelize/issues/5173
  let matchingPatients: Patient[];
  if (demo.personalIdentifiers && demo.personalIdentifiers.length > 0) {
    matchingPatients = patients.filter(
      p =>
        intersectionWith(p.data.personalIdentifiers, demo.personalIdentifiers, isEqual).length > 0
    );
  } else {
    matchingPatients = patients;
  }
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
      demograhics: demo,
      patients: matchingPatients.map(p => ({ id: p.id, data: p.data })),
    },
  });

  return chosenOne;
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
