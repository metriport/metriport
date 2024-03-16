import { Bundle, Resource } from "@medplum/fhirtypes";
import {
  ConsolidationConversionType,
  Input as ConversionInput,
  Output as ConversionOutput,
} from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { createMRSummaryFileName } from "@metriport/core/domain/medical-record-summary";
import { Patient } from "@metriport/core/domain/patient";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { makeS3Client } from "@metriport/core/external/aws/s3";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { ResourceTypeForConsolidation } from "../../../domain/medical/consolidation-resources";
import { Config } from "../../../shared/config";
import { getSandboxSeedData } from "../../../shared/sandbox/sandbox-seed-data";
import { convertDoc } from "../document/document-download";

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
const emptyMetaProp = "na";

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
  conversionType: ConsolidationConversionType;
}): Promise<Bundle<Resource>> {
  const isSandbox = Config.isSandbox();

  if (isSandbox) {
    const patientMatch = getSandboxSeedData(patient.data.firstName);
    const url = await processSandboxSeed({
      firstName: patientMatch ? patient.data.firstName : "jane",
      conversionType,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      bucketName: Config.getSandboxSeedBucketName()!,
    });

    return buildBundle(patient, url, conversionType);
  }

  const { url, hasContents } = await convertFHIRBundleToMedicalRecord({
    bundle,
    patient,
    resources,
    dateFrom,
    dateTo,
    conversionType,
  });

  const newBundle = buildBundle(patient, url, conversionType);
  if (!hasContents) {
    console.log(`No contents in the consolidated data for patient ${patient.id}`);
    bundle.entry = [];
  }
  return newBundle;
}

function buildBundle(
  patient: Pick<Patient, "id">,
  url: string,
  conversionType: ConsolidationConversionType
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
}): Promise<ConversionOutput> {
  const lambdaName = Config.getFHIRToMedicalRecordLambdaName();

  if (!lambdaName) throw new Error("FHIR to Medical Record Lambda Name is undefined");

  // Store the bundle on S3
  const fileName = createMRSummaryFileName(patient.cxId, patient.id, "json");

  await s3
    .putObject({
      Bucket: Config.getMedicalDocumentsBucketName(),
      Key: fileName,
      Body: JSON.stringify(bundle),
      ContentType: "application/json",
      Metadata: {
        patientId: patient.id,
        cxId: patient.cxId,
        resources: resources?.toString() ?? emptyMetaProp,
        dateFrom: dateFrom ?? emptyMetaProp,
        dateTo: dateTo ?? emptyMetaProp,
        conversionType,
      },
    })
    .promise();

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

async function processSandboxSeed({
  firstName,
  conversionType,
  bucketName,
}: {
  firstName: string;
  conversionType: ConsolidationConversionType;
  bucketName: string;
}): Promise<string> {
  const lowerCaseName = firstName.toLowerCase();
  const fileName = `${lowerCaseName}-consolidated.xml`;

  const url = await convertDoc({ fileName, conversionType, bucketName });
  return url;
}
