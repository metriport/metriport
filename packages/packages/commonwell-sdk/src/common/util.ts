import { StrongId } from "../models/identifier";
import { Organization } from "../models/organization";
import { Patient } from "../models/patient";
import { Person, PersonSearchResp } from "../models/person";

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

export function getIdTrailingSlash(object: Patient | Organization): string | undefined {
  const url = object._links?.self?.href;
  if (!url) return undefined;
  const removeTrailingSlash = url.substring(0, url.length - 1);
  return removeTrailingSlash.substring(removeTrailingSlash.lastIndexOf("/") + 1);
}

export function getPatientStrongIds(object: Patient): StrongId[] | undefined {
  return object.identifier;
}

function buildPatiendIdToDocQuery(code: string, system: string): string {
  return `${system}|${code}`;
}

export function convertPatiendIdToDocQuery(patientId: string): string | undefined {
  const value = decodeURIComponent(decodeURI(patientId));
  const regex = /(.+)\^\^\^(.+)/i;
  const match = value.match(regex);
  return match.length > 2 ? buildPatiendIdToDocQuery(match[1], match[2]) : undefined;
}
