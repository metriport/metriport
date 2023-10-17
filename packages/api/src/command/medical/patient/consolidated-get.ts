import { OperationOutcomeError } from "@medplum/core";
import {
  Bundle,
  BundleEntry,
  ExtractResource,
  OperationOutcomeIssue,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import {
  FhirToMedicalRecordPayload,
  ConsolidationConversionType,
} from "@metriport/api-sdk/medical/models/fhir";
import { Config } from "../../../shared/config";
import { Patient } from "../../../domain/medical/patient";
import { QueryProgress } from "../../../domain/medical/query-status";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import {
  fullDateQueryForResource,
  getPatientFilter,
} from "../../../external/fhir/patient/resource-filter";
import { capture } from "../../../shared/notifications";
import { emptyFunction, Util } from "../../../shared/util";
import { updateConsolidatedQueryProgress } from "./append-consolidated-query-progress";
import { processConsolidatedDataWebhook } from "./consolidated-webhook";
import { getPatientOrFail } from "./get-patient";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

export async function startConsolidatedQuery({
  cxId,
  patientId,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: {
  cxId: string;
  patientId: string;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType?: ConsolidationConversionType;
}): Promise<QueryProgress> {
  const { log } = Util.out(`queryDocumentsAcrossHIEs - M patient ${patientId}`);
  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (patient.data.consolidatedQuery?.status === "processing") {
    log(`Patient ${patientId} consolidatedQuery is already 'processing', skipping...`);
    return patient.data.consolidatedQuery;
  }

  const progress: QueryProgress = { status: "processing" };
  await updateConsolidatedQueryProgress({
    patient,
    progress,
    reset: true,
  });
  getConsolidatedAndSendToCx({ patient, resources, dateFrom, dateTo, conversionType }).catch(
    emptyFunction
  );
  return progress;
}

async function getConsolidatedAndSendToCx({
  patient,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: {
  patient: Pick<Patient, "id" | "cxId" | "data">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType?: ConsolidationConversionType;
}): Promise<void> {
  const { log } = Util.out(
    `getConsolidatedAndSendToCx - cxId ${patient.cxId}, patientId ${patient.id}`
  );
  const filters = { resources: resources ? resources.join(", ") : undefined, dateFrom, dateTo };
  try {
    let bundle = await getConsolidatedPatientData({ patient, resources, dateFrom, dateTo });

    if (conversionType) {
      bundle = await handleBundleToMedicalRecord({
        bundle,
        patient,
        resources,
        dateFrom,
        dateTo,
        conversionType,
      });
    }

    // trigger WH call
    processConsolidatedDataWebhook({
      patient,
      status: "completed",
      bundle,
      filters,
    }).catch(emptyFunction);
  } catch (error) {
    log(`Failed to get FHIR resources: ${JSON.stringify(filters)}`);
    processConsolidatedDataWebhook({
      patient,
      status: "failed",
      filters: { resources: resources ? resources.join(", ") : undefined, dateFrom, dateTo },
    }).catch(emptyFunction);
    capture.error(error, {
      extra: {
        context: `getConsolidatedAndSendToCx`,
        patientId: patient.id,
        filters,
        error,
      },
    });
  }
}

export async function getConsolidatedPatientData({
  patient,
  resources,
  dateFrom,
  dateTo,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
}): Promise<Bundle<Resource>> {
  const { log } = Util.out(
    `getConsolidatedPatientData - cxId ${patient.cxId}, patientId ${patient.id}`
  );
  const { id: patientId, cxId } = patient;
  const {
    resourcesByPatient,
    resourcesBySubject,
    dateFilter: fullDateQuery,
  } = getPatientFilter({
    resources,
    dateFrom,
    dateTo,
  });
  log(`Getting consolidated data with resources by patient: ${resourcesByPatient.join(", ")}...`);
  log(`...and by subject: ${resourcesBySubject.join(", ")}`);

  const fhir = makeFhirApi(cxId);
  const errorsToReport: Record<string, string> = {};

  const settled = await Promise.allSettled([
    ...resourcesByPatient.map(async resource => {
      const dateFilter = fullDateQueryForResource(fullDateQuery, resource);
      return searchResources(
        resource,
        () => fhir.searchResourcePages(resource, `patient=${patientId}${dateFilter}`),
        errorsToReport
      );
    }),
    ...resourcesBySubject.map(async resource => {
      const dateFilter = fullDateQueryForResource(fullDateQuery, resource);
      return searchResources(
        resource,
        () => fhir.searchResourcePages(resource, `subject=${patientId}${dateFilter}`),
        errorsToReport
      );
    }),
  ]);

  const success: Resource[] = settled.flatMap(s => (s.status === "fulfilled" ? s.value : []));

  const failuresAmount = Object.keys(errorsToReport).length;
  if (failuresAmount > 0) {
    log(
      `Failed to get FHIR resources (${failuresAmount} failures, ${
        success.length
      } succeeded): ${JSON.stringify(errorsToReport)}`
    );
    capture.message(`Failed to get FHIR resources`, {
      extra: {
        context: `getConsolidatedPatientData`,
        patientId,
        errorsToReport,
        succeeded: success.length,
        failed: failuresAmount,
      },
      level: "error",
    });
  }

  const entry: BundleEntry[] = success.map(r => ({ resource: r }));
  return buildResponse(entry);
}

const searchResources = async <K extends ResourceType>(
  resource: K,
  searchFunction: () => AsyncGenerator<ExtractResource<K>[]>,
  errorsToReport: Record<string, string>
) => {
  try {
    const pages: Resource[] = [];
    for await (const page of searchFunction()) {
      pages.push(...page);
    }
    return pages;
  } catch (err) {
    if (err instanceof OperationOutcomeError && err.outcome.id === "not-found") throw err;
    if (err instanceof OperationOutcomeError) errorsToReport[resource] = getMessage(err);
    else errorsToReport[resource] = String(err);
    throw err;
  }
};

function buildResponse(entries: BundleEntry[]): Bundle<Resource> {
  return { resourceType: "Bundle", total: entries.length, type: "searchset", entry: entries };
}

function getMessage(err: OperationOutcomeError): string {
  return err.outcome.issue ? err.outcome.issue.map(issueToString).join(",") : "";
}

function issueToString(issue: OperationOutcomeIssue): string {
  return (
    issue.details?.text ??
    (issue.diagnostics ? issue.diagnostics.slice(0, 100) + "..." : null) ??
    JSON.stringify(issue)
  );
}

async function handleBundleToMedicalRecord({
  bundle,
  patient,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: {
  bundle: Bundle<Resource>;
  patient: Pick<Patient, "id" | "cxId" | "data">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType: ConsolidationConversionType;
}): Promise<Bundle<Resource>> {
  const fhir = makeFhirApi(patient.cxId);

  const fhirPatient = await fhir.readResource("Patient", patient.id);

  const bundleWithPatient: Bundle<Resource> = {
    ...bundle,
    total: (bundle.total ?? 0) + 1,
    entry: [
      {
        resource: fhirPatient,
      },
      ...(bundle.entry ?? []),
    ],
  };

  const url = await convertFHIRBundleToMedicalRecord({
    bundle: bundleWithPatient,
    patient,
    resources,
    dateFrom,
    dateTo,
    conversionType,
  });

  return {
    resourceType: "Bundle",
    total: 1,
    type: "collection",
    entry: [
      {
        resource: {
          resourceType: "DocumentReference",
          subject: {
            reference: `Patient/${patient.id}`,
          },
          content: [
            {
              attachment: {
                contentType: `application/${conversionType}`,
                url: url,
              },
            },
          ],
        },
      },
    ],
  };
}

async function convertFHIRBundleToMedicalRecord({
  bundle,
  patient,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: {
  bundle: Bundle<Resource>;
  patient: Pick<Patient, "id" | "cxId" | "data">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType: ConsolidationConversionType;
}): Promise<string> {
  const lambdaName = Config.getFHIRToMedicalRecordLambdaName();

  const payload: FhirToMedicalRecordPayload = {
    bundle,
    patientId: patient.id,
    firstName: patient.data.firstName,
    cxId: patient.cxId,
    resources,
    dateFrom,
    dateTo,
    conversionType,
  };

  const lambdaResult = await lambdaClient
    .invoke({
      FunctionName: lambdaName,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(payload),
    })
    .promise();

  if (lambdaResult.StatusCode !== 200)
    throw new MetriportError("Lambda invocation failed", undefined, { lambdaName });

  if (lambdaResult.Payload === undefined)
    throw new MetriportError("Payload is undefined", undefined, { lambdaName });

  const url = lambdaResult.Payload.toString();

  return url.replace(/['"]+/g, "");
}
