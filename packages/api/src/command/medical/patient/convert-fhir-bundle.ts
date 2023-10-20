import { Bundle, Resource } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/api-sdk";
import {
  ConsolidationConversionType,
  Input as ConversionInput,
  Output as ConversionOutput,
} from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { getLambdaResultPayload, makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { makeS3Client } from "@metriport/core/external/aws/s3";
import { Patient } from "../../../domain/medical/patient";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { Config } from "../../../shared/config";

const region = Config.getAWSRegion();
const lambdaClient = makeLambdaClient(region);
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

  // Store the bundle on S3
  const fileName = createFileName({
    cxId: patient.cxId,
    patientId: patient.id,
    resources,
    dateFrom,
    dateTo,
  });
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
