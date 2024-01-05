import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import {
  ConsolidationConversionType,
  Input as ConversionInput,
  Output as ConversionOutput,
} from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { makeS3Client } from "@metriport/core/external/aws/s3";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Patient } from "@metriport/core/domain/medical/patient";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { Config } from "../../../shared/config";
import { createS3FileName } from "../../../shared/external";
import { getSandboxSeedData } from "../../../shared/sandbox/sandbox-seed-data";
import { convertDoc } from "../document/document-download";

dayjs.extend(duration);

/**
 * Keep this a couple seconds higher than the respective lambda's timeout.
 * @see {@link setupFhirToMedicalRecordLambda()} on the infra package for the lambda's timeout.
 */
// TODO https://github.com/metriport/metriport-internal/issues/1319 to decrease this significantly
export const TIMEOUT_CALLING_CONVERTER_LAMBDA = dayjs.duration(15, "minutes").add(2, "seconds");
export const MEDICAL_RECORD_KEY = "MR";

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

  return buildBundle(patient, url, conversionType);
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
}): Promise<string> {
  const lambdaName = Config.getFHIRToMedicalRecordLambdaName();

  if (!lambdaName) throw new Error("FHIR to Medical Record Lambda Name is undefined");

  // Store the bundle on S3
  const fileName = createS3FileName(patient.cxId, patient.id, `${MEDICAL_RECORD_KEY}.json`);

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

  const parsedResult = JSON.parse(resultPayload) as ConversionOutput;
  return parsedResult.url;
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
