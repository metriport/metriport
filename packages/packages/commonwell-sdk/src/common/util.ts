import { Person, PersonSearchResp } from "../models/person";
import { Patient } from "../models/patient";

function getPersonIdFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.substring(url.lastIndexOf("/") + 1);
}

export function getId(object: Person): string | undefined {
  const url = object._links?.self?.href;
  return getPersonIdFromUrl(url);
}

export function getPersonIdFromSearchByPatientDemo(object: PersonSearchResp): string | undefined {
  if (!object._embedded || !object._embedded.person) return undefined;
  const embeddedPersons = object._embedded.person.filter(p => p.enrolled);
  if (embeddedPersons.length < 1) return undefined;
  if (embeddedPersons.length > 1) {
    console.log(`Found more than one person, using the first one: `, object);
  }
  const person = embeddedPersons[0];
  const url = person._links?.self?.href;
  return getPersonIdFromUrl(url);
}

export function getPatientId(object: Patient): string | undefined {
  const url = object._links?.self?.href;
  if (!url) return undefined;
  const removeTrailingSlash = url.substring(0, url.length - 1);
  return removeTrailingSlash.substring(removeTrailingSlash.lastIndexOf("/") + 1);
}

// export function getPatientIdFromSearch(searchResponse: PatientSearchResp): string | undefined {
//   if (!searchResponse._embedded || !searchResponse._embedded.patient) return undefined;
//   const embeddedPatients = searchResponse._embedded.patient.filter(p => p.active);
//   if (embeddedPatients.length < 1) return undefined;
//   if (embeddedPatients.length > 1) {
//     console.log(`Found more than one patient, using the first one: `, searchResponse);
//   }
//   const patient = embeddedPatients[0];
//   const url = patient._links?.self?.href;
//   if (!url) return undefined;
//   return getPatientIdFromUrl(url);
// }
