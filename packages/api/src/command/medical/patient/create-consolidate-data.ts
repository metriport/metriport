import { Bundle, BundleEntry, Patient } from "@medplum/fhirtypes";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { Util } from "../../../shared/util";

export async function createOrUpdateConsolidatedPatientData({
  cxId,
  patientId,
  fhirBundle,
}: {
  cxId: string;
  patientId: string;
  fhirBundle: Bundle;
}): Promise<Bundle | undefined> {
  const { log } = Util.out(
    `createOrUpdateConsolidatedPatientData - cxId ${cxId}, patientId ${patientId}`
  );

  try {
    const fhir = makeFhirApi(cxId);

    const patient = await fhir.readResource("Patient", patientId);

    const fhirBundleTransaction = convertCollectionBundleToTransactionBundle({
      patient,
      fhirBundle,
    });

    const bundleResource = await fhir.executeBatch(fhirBundleTransaction);

    return bundleResource;
  } catch (error) {
    log(`Error converting and executing fhir bundle resources: `, error);
    throw error;
  }
}

const convertCollectionBundleToTransactionBundle = ({
  patient,
  fhirBundle,
}: {
  patient: Patient;
  fhirBundle: Bundle;
}): Bundle => {
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
      resource: {
        ...resource,
        contained: resource.contained ? [...resource.contained, patient] : [patient],
      },
      request: resource.id
        ? { method: "PUT", url: resource.resourceType + "/" + resource.id }
        : { method: "POST", url: resource.resourceType },
    };

    transactionBundle.entry?.push(transactionEntry);
  }

  return transactionBundle;
};
