import { intersectionWith, isEqual } from "lodash";
import { Op, Transaction } from "sequelize";
import NotFoundError from "../../../errors/not-found";
import { FacilityModel } from "../../../models/medical/facility";
import { OrganizationModel } from "../../../models/medical/organization";
import { Patient, PatientData, PatientModel, splitName } from "../../../models/medical/patient";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getFacilities } from "../facility/get-facility";
import { getOrganizationOrFail } from "../organization/get-organization";
import jaroWinkler from 'jaro-winkler';


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

    // Basic Implementation with semi-arbitrary threshold
    const jw_score = calculatePatientSimilarity(patient.data, demo);
    console.log('Similarity Score:', jw_score);
    if (jw_score >= 0.95) {
      return patient;
    }

    // If the IDs don't match, or none were provided, check the demo for a match
    // let demoMatch =
    //   intersectionWith(splitName(patient.data.firstName), splitName(demo.firstName), isEqual)
    //     .length > 0 &&
    //   intersectionWith(splitName(patient.data.lastName), splitName(demo.lastName), isEqual).length >
    //     0 &&
    //   intersectionWith(patient.data.address, demo.address, isEqual).length > 0;
    // if (demoMatch && demo.contact && demo.contact.length > 0) {
    //   demoMatch = intersectionWith(patient.data.contact, demo.contact, isEqual).length > 0;
    // }
    // return demoMatch;
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

/**
 * This function calculates the similarity between two patients using the Jaro-Winkler algorithm.
 * It returns a score between 0 and 1, where 1 means the patients are identical. We calculate scores
 * for the following fields: First Name, Last Name, Address Line 1, Address Line 2, City, State, Country, Zipcode. 
 * This function won't be called if gender and DOB are not identical, so that is a givem. 
 * @param patient1
 * @param patient2
 * @returns The average of the similarity scores for each field. 
 */
export const calculatePatientSimilarity = (patient1: PatientData, patient2: PatientData): number => {
  let score = 0;
  let fieldCount = 0;
  const similarityScores: { [key: string]: number } = {};

  const addScore = (field: string, value1: any, value2: any) => {
    const similarity = jaroWinkler(value1, value2);
    similarityScores[field] = similarity;
    score += similarity;
    fieldCount += 1;
  };

  addScore('First Name', patient1.firstName, patient2.firstName);
  addScore('Last Name', patient1.lastName, patient2.lastName);

  // Calculate similarity for addresses
  const address1 = patient1.address[0];
  const address2 = patient2.address[0]; 

  if (address1 && address2) {
    if (address1.addressLine1 && address2.addressLine1) {
      addScore('Address Line 1', address1.addressLine1, address2.addressLine1);
    }

    if (address1.addressLine2 && address2.addressLine2) {
      addScore('Address Line 2', address1.addressLine2, address2.addressLine2);
    }
    
    if (address1.city && address2.city) {
      addScore('City', address1.city, address2.city);
    }

    if (address1.state && address2.state) {
      addScore('State', address1.state, address2.state);
    }

    addScore('Country', address1.country, address2.country);
    addScore('Zipcode', address1.zip, address2.zip);
  }

  // Calculate similarity for contact details
  const contact1 = patient1.contact ? patient1.contact[0] : null;
  const contact2 = patient2.contact ? patient2.contact[0] : null; 

  if (contact1 && contact2) {
    if (contact1.phone && contact2.phone) {
      addScore('Phone', contact1.phone, contact2.phone);
    }
    
    if (contact1.email && contact2.email) {
      addScore('Email', contact1.email, contact2.email);
    }
  }

  const totalScore = score / fieldCount;
  similarityScores['Total Score'] = totalScore;
  console.log(JSON.stringify(similarityScores, null, 2)); // should this be logged using util.out with log or debug instead?
  return totalScore;
};




