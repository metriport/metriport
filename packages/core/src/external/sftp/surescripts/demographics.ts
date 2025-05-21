export function parseNameDemographics({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): {
  firstName: string;
  middleName: string;
  lastName: string;
  prefix: string;
  suffix: string;
} {
  // TODO: implement name demographic splitting
  return { firstName, middleName: "", lastName, prefix: "", suffix: "" };
}
