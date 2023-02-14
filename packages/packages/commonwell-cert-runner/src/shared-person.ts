import {
  CommonWell,
  getId,
  getIdTrailingSlash,
  getPersonIdFromSearchByPatientDemo,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { getPatientStrongIds } from "@metriport/commonwell-sdk/lib/common/util";
import { docPerson, metriportSystem, patient } from "./payloads";

export async function findOrCreatePerson(
  commonWell: CommonWell,
  queryMeta: RequestMetadata,
  patientData: ReturnType<typeof docPerson> | typeof patient
): Promise<{ patientId: string; personId: string }> {
  const respPatient = await commonWell.searchPatient(
    queryMeta,
    patientData.details.name[0].given[0],
    patientData.details.name[0].family[0],
    patientData.details.birthDate,
    patientData.details.gender.code,
    patientData.details.address[0].zip
  );
  console.log(respPatient);

  let personId: string | undefined = undefined;
  let patientId: string | undefined = undefined;

  // IF THERE'S A PATIENT, USE IT
  if (respPatient._embedded?.patient?.length > 0) {
    const embeddedPatients = respPatient._embedded.patient;
    if (embeddedPatients.length > 1) {
      console.log(`Found more than one patient, using the first one`);
    } else {
      console.log(`Found a patient, using it`);
    }
    const patient = embeddedPatients[0];
    patientId = getIdTrailingSlash(patient);

    const respPerson = await commonWell.searchPersonByPatientDemo(queryMeta, patientId);
    console.log(respPerson);
    personId = getPersonIdFromSearchByPatientDemo(respPerson);

    //
  } else {
    // OTHERWISE ADD ONE
    console.log(`Did not find a patient, creating person and patient`);
    const respPerson = await commonWell.enrollPerson(queryMeta, patientData);
    console.log(respPerson);
    personId = getId(respPerson);

    const respPatientCreate = await commonWell.registerPatient(queryMeta, patientData);
    console.log(respPatientCreate);
    patientId = getIdTrailingSlash(respPatientCreate);
    const patientStrongIds = getPatientStrongIds(respPatientCreate);
    const patientStrongId = patientStrongIds
      ? patientStrongIds.find(id => id.system === metriportSystem)
      : undefined;

    const patientLink = respPatientCreate._links.self.href;
    const respLink = await commonWell.patientLink(
      queryMeta,
      personId,
      patientLink,
      patientStrongId
    );
    console.log(respLink);
  }
  return { patientId, personId };
}
