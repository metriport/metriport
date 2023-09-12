import { DocumentReference } from "@medplum/fhirtypes";
import { nameContains as humanNameContains } from "../patient/resource-filter";

export function containedHasNames({
  organizationName,
  practitionerName,
}: {
  organizationName?: string;
  practitionerName?: string;
}) {
  return (doc: DocumentReference) => {
    if (organizationName) {
      const org = doc.contained?.find(
        resource =>
          resource.resourceType === "Organization" &&
          resource.name?.toLocaleLowerCase().includes(organizationName.toLocaleLowerCase())
      );
      if (!org) return false;
    }
    if (practitionerName) {
      const practitioner = doc.contained?.find(
        resource =>
          resource.resourceType === "Practitioner" &&
          resource.name?.find(humanNameContains(practitionerName))
      );
      if (!practitioner) return false;
    }
    return true;
  };
}
