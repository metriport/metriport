import { Bundle, DocumentReference, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import {
  ConsolidationConversionType,
  Input as ConversionInput,
  MedicalRecordFormat,
  Output as ConversionOutput,
} from "@metriport/core/domain/conversion/fhir-to-medical-record";
import {
  createMRSummaryFileName,
  createSandboxMRSummaryFileName,
} from "@metriport/core/domain/medical-record-summary";
import { getConsolidatedQueryByRequestId, Patient } from "@metriport/core/domain/patient";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { makeS3Client, S3Utils } from "@metriport/core/external/aws/s3";
import {
  buildBundleEntry,
  buildSearchSetBundle,
} from "@metriport/core/external/fhir/bundle/bundle";
import { out } from "@metriport/core/util";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { SearchSetBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../shared/config";
import { getSandboxSeedData } from "../../../shared/sandbox/sandbox-seed-data";

dayjs.extend(duration);

const s3Utils = new S3Utils(Config.getAWSRegion());

/**
 * Keep this a couple seconds higher than the respective lambda's timeout.
 * @see {@link setupFhirToMedicalRecordLambda()} on the infra package for the lambda's timeout.
 */
// TODO https://github.com/metriport/metriport-internal/issues/1319 to decrease this significantly
export const TIMEOUT_CALLING_CONVERTER_LAMBDA = dayjs.duration(15, "minutes").add(2, "seconds");

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region, TIMEOUT_CALLING_CONVERTER_LAMBDA.asMilliseconds());
const s3 = makeS3Client(Config.getAWSRegion());
export const emptyMetaProp = "na";

export async function handleBundleToMedicalRecord({
  bundle,
  patient,
  requestId,
  resources,
  dateFrom,
  dateTo,
  conversionType,
}: {
  bundle: Bundle<Resource>;
  patient: Pick<Patient, "id" | "cxId" | "data">;
  requestId?: string;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  conversionType: MedicalRecordFormat;
}): Promise<SearchSetBundle<Resource>> {
  const { log } = out(`handleBundleToMedicalRecord - pt ${patient.id}`);
  const bucketName = Config.getSandboxSeedBucketName();
  if (Config.isSandbox() && bucketName) {
    const patientMatch = getSandboxSeedData(patient.data.firstName);
    const patientNameLowerCase = patientMatch ? patient.data.firstName.toLowerCase() : "jane";
    const fileName = createSandboxMRSummaryFileName(patientNameLowerCase, conversionType);
    const url = await s3Utils.getSignedUrl({
      bucketName,
      fileName,
    });
    return buildDocRefBundleWithAttachment(patient.id, url, conversionType);
  }

  const { url, hasContents } = await convertFHIRBundleToMedicalRecord({
    bundle,
    patient,
    resources,
    dateFrom,
    dateTo,
    conversionType,
  });

  const newBundle = buildDocRefBundleWithAttachment(patient.id, url, conversionType);
  if (!hasContents) {
    log(`No contents in the consolidated data for patient ${patient.id}`);
    newBundle.entry = [];
    newBundle.total = 0;
  }

  const currentConsolidatedProgress = getConsolidatedQueryByRequestId(patient, requestId);
  analytics({
    distinctId: patient.cxId,
    event: EventTypes.consolidatedQuery,
    properties: {
      patientId: patient.id,
      conversionType,
      duration: elapsedTimeFromNow(currentConsolidatedProgress?.startedAt),
      resourceCount: newBundle.entry?.length,
    },
  });
  return newBundle;
}

export function buildDocRefBundleWithAttachment(
  patientId: string,
  attachmentUrl: string,
  mimeType: ConsolidationConversionType
): SearchSetBundle<Resource> {
  const docRef: DocumentReference = {
    resourceType: "DocumentReference",
    subject: {
      reference: `Patient/${patientId}`,
    },
    content: [
      {
        attachment: {
          contentType: `application/${mimeType}`,
          url: attachmentUrl,
        },
      },
    ],
  };
  return buildSearchSetBundle([buildBundleEntry(docRef)]);
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
  conversionType: MedicalRecordFormat;
}): Promise<ConversionOutput> {
  const { log } = out(`convertFHIRBundleToMedicalRecord - cx ${patient.cxId} pt ${patient.id}`);
  const lambdaName = Config.getFHIRToMedicalRecordLambda2Name();

  if (!lambdaName) throw new Error("FHIR to Medical Record Lambda Name is undefined");
  log(`Using lambda name: ${lambdaName}`);

  // Store the bundle on S3
  const fileName = createMRSummaryFileName(patient.cxId, patient.id, "json");
  const metadata = {
    patientId: patient.id,
    cxId: patient.cxId,
    resources: resources?.toString() ?? emptyMetaProp,
    dateFrom: dateFrom ?? emptyMetaProp,
    dateTo: dateTo ?? emptyMetaProp,
    conversionType,
  };

  await uploadJsonBundleToS3({
    bundle,
    fileName,
    metadata,
  });
  // Send it to conversion
  const activeLambdaPayload: ConversionInput = {
    fileName,
    patientId: patient.id,
    firstName: patient.data.firstName,
    cxId: patient.cxId,
    dateFrom,
    dateTo,
    conversionType,
  };

  const [result] = await Promise.all([
    lambdaClient
      .invoke({
        FunctionName: lambdaName,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify(activeLambdaPayload),
      })
      .promise(),
  ]);
  const resultPayload = getLambdaResultPayload({ result, lambdaName });
  return JSON.parse(resultPayload) as ConversionOutput;
}

export async function uploadJsonBundleToS3({
  bundle,
  fileName,
  metadata,
}: {
  bundle: Bundle<Resource>;
  fileName: string;
  metadata: Record<string, string>;
}) {
  await s3
    .putObject({
      Bucket: Config.getMedicalDocumentsBucketName(),
      Key: fileName,
      Body: JSON.stringify(bundle),
      ContentType: "application/json",
      Metadata: metadata,
    })
    .promise();
}
