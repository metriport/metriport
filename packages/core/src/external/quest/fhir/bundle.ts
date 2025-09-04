import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { buildBundle } from "../../fhir/bundle/bundle";
import { LogFunction } from "../../../util/log";
import { IncomingData } from "../schema/shared";
import { ResponseDetail } from "../schema/response";
import { getPatient } from "./patient";
import { getPractitioner, getPractitionerRole } from "./practitioner";
import { getOrganization } from "./organization";
import { getLocation } from "./location";
import { getConditions } from "./condition";
import { getServiceRequest } from "./service-request";
import { getObservation } from "./observation";
import { getDiagnosticReport } from "./diagnostic-report";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { hydrateFhir } from "../../fhir/hydration/hydrate-fhir";
import { getSpecimen } from "./specimen";

export async function convertTabularDataToFhirBundle({
  cxId,
  patientId,
  rows,
  log,
}: {
  cxId: string;
  patientId: string;
  rows: IncomingData<ResponseDetail>[];
  log: LogFunction;
}): Promise<Bundle> {
  const entries = rows.flatMap(getBundleEntries);
  const bundle = buildBundle({ type: "collection", entries });
  dangerouslyDeduplicateFhir(bundle, cxId, patientId);
  const { data: hydratedBundle } = await hydrateFhir(bundle, log);
  return hydratedBundle;
}

/**
 * This function builds the bundle entries for a single row of data in a Quest notification. The resulting FHIR resources are combined by
 * standard deduplication to generate the final bundle for a particular set of lab results that arrive in multiple rows.
 * @param data - An object containing a key-value mapping of column headers to column values from a single row of data.
 * @returns An array of FHIR resources as bundle entries for any data in this row.
 */
function getBundleEntries({ data }: IncomingData<ResponseDetail>): BundleEntry[] {
  const patient = getPatient(data);
  const practitioner = getPractitioner(data);
  const organization = getOrganization(data);
  const location = getLocation(data);
  const practitionerRole = getPractitionerRole({
    practitioner,
    organization,
  });
  const observation = getObservation(data, {
    patient,
  });
  const serviceRequest = getServiceRequest(data, {
    patient,
    requestingPractitioner: practitioner,
  });
  const specimen = getSpecimen(data, {
    patient,
    practitioner,
    serviceRequest,
  });
  const diagnosticReport = getDiagnosticReport(data, {
    patient,
    specimen,
    observation,
    serviceRequest,
  });
  const conditions = getConditions(data, {
    patient,
    observation,
  });
  const resources: Array<Resource | undefined> = [
    patient,
    practitioner,
    practitionerRole,
    organization,
    location,
    observation,
    serviceRequest,
    specimen,
    diagnosticReport,
    ...conditions,
  ];

  return resources.flatMap(resource => {
    if (!resource || !resource.id) return [];
    return [
      {
        fullUrl: `urn:uuid:${resource.id}`,
        resource,
      },
    ];
  });
}
