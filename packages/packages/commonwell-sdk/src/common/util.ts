import { Person } from "../models/person";
import { Patient } from "../models/patient";

export function getId(object: Person): string {
  const url = object._links!.self.href;
  return url.substring(url.lastIndexOf("/") + 1);
}

export function getIdPatient(object: Patient): string {
  const url = object._links!.self.href;
  const removeTrailingSlash = url.substring(0, url.length - 1);
  return removeTrailingSlash.substring(removeTrailingSlash.lastIndexOf("/") + 1);
}