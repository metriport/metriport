import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import {
  ConsolidationConversionType,
  FhirToMedicalRecordPayload,
} from "@metriport/core/domain/fhir";
import { logResultToString, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { makeS3Client } from "@metriport/core/external/aws/s3";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { Patient } from "../../../domain/medical/patient";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { Config } from "../../../shared/config";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);

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

  // create file name
  const fileName = createFileName({
    cxId: patient.cxId,
    patientId: patient.id,
    resources,
    dateFrom,
    dateTo,
  });

  // store on S3
  const s3 = makeS3Client(Config.getAWSRegion());
  const emptyMetaProp = "na";
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

  const payload: FhirToMedicalRecordPayload = {
    fileName,
    patientId: patient.id,
    firstName: patient.data.firstName,
    cxId: patient.cxId,
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

  if (lambdaResult.StatusCode !== 200) {
    throw new MetriportError("Lambda invocation failed", undefined, {
      lambdaName,
      status: lambdaResult.StatusCode,
      log: logResultToString(lambdaResult.LogResult),
      payload: lambdaResult.Payload?.toString(),
    });
  }
  if (!lambdaResult.Payload) {
    throw new MetriportError("Payload is undefined", undefined, {
      lambdaName,
      status: lambdaResult.StatusCode,
      log: logResultToString(lambdaResult.LogResult),
    });
  }

  // TODO Gotta check for error here
  // TODO Gotta check for error here
  // TODO Gotta check for error here
  // TODO Gotta check for error here
  // TODO Gotta check for error here
  // TODO Gotta check for error here
  // TODO Gotta check for error here
  const url = lambdaResult.Payload.toString();

  return url.replace(/['"]+/g, "");
}

// TODO review this logic, ideally we'd have these parameter stored on the S3 object's metadata and not on the filename
function createFileName({
  cxId,
  patientId,
  resources,
  dateFrom,
  dateTo,
}: {
  cxId: string;
  patientId: string;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
}): string {
  const MEDICAL_RECORD_KEY = "MR";
  let fileName = `${cxId}/${patientId}/${cxId}_${patientId}_${MEDICAL_RECORD_KEY}`;

  if (resources) {
    fileName = `${fileName}_${resources.toString()}`;
  }

  if (dateFrom) {
    fileName = `${fileName}_${dateFrom}`;
  }

  if (dateTo) {
    fileName = `${fileName}_${dateTo}`;
  }

  return `${fileName}.json`;
}
