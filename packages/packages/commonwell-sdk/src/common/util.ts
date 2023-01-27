import { Person } from "../models/person";
import { Patient } from "../models/patient";
import { Organization } from "../models/organization";

export function getId(object: Person): string {
  const url = object._links!.self.href;
  return url.substring(url.lastIndexOf("/") + 1);
}

export function getIdTrailingSlash(object: Patient | Organization): string {
  const url = object._links!.self.href;
  const removeTrailingSlash = url.substring(0, url.length - 1);
  return removeTrailingSlash.substring(removeTrailingSlash.lastIndexOf("/") + 1);
}
