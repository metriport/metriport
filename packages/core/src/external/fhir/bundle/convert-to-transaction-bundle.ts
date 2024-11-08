import { Bundle, BundleEntry } from "@medplum/fhirtypes";

export function convertCollectionBundleToTransactionBundle({
  fhirBundle,
}: {
  fhirBundle: Bundle;
}): Bundle {
  const transactionBundle: Bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: [],
  };

  for (const entry of fhirBundle.entry || []) {
    const resource = entry.resource;
    if (!resource) {
      continue;
    }

    if (
      resource.resourceType === "Agent" ||
      resource.resourceType === "AsyncJob" ||
      resource.resourceType === "AccessPolicy" ||
      resource.resourceType === "Binary" ||
      resource.resourceType === "Bot" ||
      resource.resourceType === "BulkDataExport" ||
      resource.resourceType === "Bundle" ||
      resource.resourceType === "ClientApplication" ||
      resource.resourceType === "DomainConfiguration" ||
      resource.resourceType === "JsonWebKey" ||
      resource.resourceType === "Login" ||
      resource.resourceType === "Parameters" ||
      resource.resourceType === "PasswordChangeRequest" ||
      resource.resourceType === "Project" ||
      resource.resourceType === "ProjectMembership" ||
      resource.resourceType === "SmartAppLaunch" ||
      resource.resourceType === "User" ||
      resource.resourceType === "UserConfiguration"
    )
      continue;

    const transactionEntry: BundleEntry = {
      resource,
      request: { method: "PUT", url: resource.resourceType + "/" + resource.id },
    };

    transactionBundle.entry?.push(transactionEntry);
  }

  return transactionBundle;
}
