import { Person } from "../models/person";

export function getId(object: Person): string {
  const url = object._links!.self.href;
  return url.substring(url.lastIndexOf("/") + 1);
}
