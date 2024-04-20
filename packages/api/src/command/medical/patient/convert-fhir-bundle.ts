import { Bundle, Resource } from "@medplum/fhirtypes";
import {
  ConsolidationConversionType,
  Input as ConversionInput,
  Output as ConversionOutput,
  MedicalRecordFormat,
} from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { Patient } from "@metriport/core/domain/patient";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { S3Utils, makeS3Client } from "@metriport/core/external/aws/s3";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { ResourceTypeForConsolidation } from "../../../domain/medical/consolidation-resources";
import { Config } from "../../../shared/config";
import { getSandboxSeedData } from "../../../shared/sandbox/sandbox-seed-data";
import { createSandboxMRSummaryFileName } from "./shared";

const s3Utils = new S3Utils(Config.getAWSRegion());
dayjs.extend(duration);

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
}): Promise<Bundle<Resource>> {
  const bucketName = Config.getSandboxSeedBucketName();
  if (Config.isSandbox() && bucketName) {
    const patientMatch = getSandboxSeedData(patient.data.firstName);
    const patientNameLowerCase = patientMatch ? patient.data.firstName.toLowerCase() : "jane";
    const fileName = createSandboxMRSummaryFileName(patientNameLowerCase, conversionType);
    const url = await s3Utils.getSignedUrl({
      bucketName,
      fileName,
      durationSeconds: 60,
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
    console.log(`No contents in the consolidated data for patient ${patient.id}`);
    newBundle.entry = [];
    newBundle.total = 0;
  }
  return newBundle;
}

export function buildDocRefBundleWithAttachment(
  patientId: string,
  attachmentUrl: string,
  mimeType: ConsolidationConversionType
): Bundle<Resource> {
  return {
    resourceType: "Bundle",
    total: 1,
    type: "collection",
    entry: [
      {
        resource: {
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
  conversionType: MedicalRecordFormat;
}): Promise<ConversionOutput> {
  const lambdaName = Config.getFHIRToMedicalRecordLambdaName();
  if (!lambdaName) throw new Error("FHIR to Medical Record Lambda Name is undefined");

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
  const payload: ConversionInput = {
    fileName,
    patientId: patient.id,
    firstName: patient.data.firstName,
    cxId: patient.cxId,
    dateFrom,
    dateTo,
    conversionType,
  };

  const result = await lambdaClient
    .invoke({
      FunctionName: lambdaName,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(payload),
    })
    .promise();
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
