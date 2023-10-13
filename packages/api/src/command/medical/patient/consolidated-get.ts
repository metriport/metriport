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
import { Config } from "../../../shared/config";
import { QueryProgress } from "../../../domain/medical/query-status";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import {
  fullDateQueryForResource,
  getPatientFilter,
} from "../../../external/fhir/patient/resource-filter";
import { Patient } from "../../../models/medical/patient";
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
  asMedicalRecord,
}: {
  cxId: string;
  patientId: string;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  asMedicalRecord?: boolean;
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
  getConsolidatedAndSendToCx({ patient, resources, dateFrom, dateTo, asMedicalRecord }).catch(
    emptyFunction
  );
  return progress;
}

async function getConsolidatedAndSendToCx({
  patient,
  resources,
  dateFrom,
  dateTo,
  asMedicalRecord,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  asMedicalRecord?: boolean;
}): Promise<void> {
  const { log } = Util.out(
    `getConsolidatedAndSendToCx - cxId ${patient.cxId}, patientId ${patient.id}`
  );
  const filters = { resources: resources ? resources.join(", ") : undefined, dateFrom, dateTo };
  try {
    const bundle = await getConsolidatedPatientData({ patient, resources, dateFrom, dateTo });

    // CONVERT TO MEDICAL RECORD via Lambda
    // Ill need to add some meta or something to s3 file so that way if it has same params we dont convert again
    if (asMedicalRecord) {
      // need to append the patient to the bundle below

      const url = await convertFHIRBundleToMedicalRecord({
        bundle,
        patient,
        resources,
        dateFrom,
        dateTo,
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

async function convertFHIRBundleToMedicalRecord({
  bundle,
  patient,
  resources,
  dateFrom,
  dateTo,
}: {
  bundle: Bundle<Resource>;
  patient: Pick<Patient, "id" | "cxId">;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
}): Promise<string> {
  const lambdaName = Config.getFHIRToMedicalRecordLambdaName();

  const payload = {
    bundle,
    patientId: patient.id,
    cxId: patient.cxId,
    resources,
    dateFrom,
    dateTo,
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

  const fileUrl = lambdaResult.Payload.toString();

  return fileUrl;
}
