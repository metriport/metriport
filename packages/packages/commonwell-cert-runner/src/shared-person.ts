import {
  CommonWell,
  getId,
  getIdTrailingSlash,
  getPersonIdFromSearchByPatientDemo,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { getPatientStrongIds } from "@metriport/commonwell-sdk/lib/common/util";
import { makeDocPerson, makePatient } from "./payloads";
import { getEnvOrFail } from "./util";

const commonwellOID = getEnvOrFail("COMMONWELL_OID");

const prefixedCommonwellOID = `urn:oid:${commonwellOID}`;

export async function findOrCreatePerson(
  commonWell: CommonWell,
  queryMeta: RequestMetadata,
  patientData: ReturnType<typeof makeDocPerson> | ReturnType<typeof makePatient>
): Promise<{ patientId: string; personId: string }> {
  const res = await findOrCreatePatient(commonWell, queryMeta, patientData);

  if (res.result === "new") {
    const { patientId, patientLink, patientStrongId } = res;
    const respPerson = await commonWell.enrollPerson(queryMeta, patientData);
    console.log(respPerson);
    const personId = getId(respPerson);

    const respLink = await commonWell.patientLink(
      queryMeta,
      personId,
      patientLink,
      patientStrongId
    );
    console.log(respLink);
    return { patientId, personId };
    //
  } else {
    const { patientId, personId } = res;
    return { patientId, personId };
  }
}

type FindOrCreatePatientResult =
  | {
      result: "existing";
      patientId: string;
      personId: string;
    }
  | {
      result: "new";
      patientId: string;
      patientLink: string;
      patientStrongId?: {
        key?: string;
        system?: string;
      };
    };

export async function findOrCreatePatient(
  commonWell: CommonWell,
  queryMeta: RequestMetadata,
  patientData: ReturnType<typeof makeDocPerson> | ReturnType<typeof makePatient>,
  personId?: string
): Promise<FindOrCreatePatientResult> {
  const respPatient = await commonWell.searchPatient(
    queryMeta,
    patientData.details.name[0].given[0],
    patientData.details.name[0].family[0],
    patientData.details.birthDate,
    patientData.details.gender.code,
    patientData.details.address[0].zip
  );
  console.log(respPatient);

  // IF THERE'S A PATIENT, USE IT
  if (respPatient._embedded?.patient?.length > 0) {
    const embeddedPatients = respPatient._embedded.patient;
    if (embeddedPatients.length > 1) {
      console.log(`Found more than one patient, using the first one`);
    } else {
      console.log(`Found a patient, using it`);
    }
    const patient = embeddedPatients[0];
    const patientId = getIdTrailingSlash(patient);

    const respPerson = await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
    console.log(respPerson);
    const personId = getPersonIdFromSearchByPatientDemo(respPerson);
    return { result: "existing", patientId, personId };

    //
  } else {
    // OTHERWISE ADD ONE
    console.log(`Did not find a patient, creating one`);
    const respPatientCreate = await commonWell.registerPatient(queryMeta, patientData);
    console.log(respPatientCreate);
    const patientId = getIdTrailingSlash(respPatientCreate);
    const patientLink = respPatientCreate._links.self.href;
    const patientStrongIds = getPatientStrongIds(respPatientCreate);
    const patientStrongId = patientStrongIds
      ? patientStrongIds.find(id => id.system === prefixedCommonwellOID)
      : undefined;
    if (personId) {
      // Link the patient to the person
      const respLink = await commonWell.patientLink(
        queryMeta,
        personId,
        patientLink,
        patientStrongId
      );
      console.log(respLink);
    }
    return { result: "new", patientId, patientLink, patientStrongId };
  }
}
