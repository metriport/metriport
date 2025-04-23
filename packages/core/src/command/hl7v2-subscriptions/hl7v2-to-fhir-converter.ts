import { Hl7Message } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { S3Utils, StoreInS3Params, storeInS3WithRetries } from "../../external/aws/s3";
import { toFHIR as toFhirPatient } from "../../external/fhir/patient/conversion";
import { buildBundle, buildBundleEntry } from "../../external/fhir/shared/bundle";
import { out } from "../../util";
import { Config } from "../../util/config";
import { JSON_APP_MIME_TYPE } from "../../util/mime";
import { convertHl7v2MessageToFhir } from "./hl7v2-to-fhir-conversion";
import { getHl7MessageTypeOrFail } from "./hl7v2-to-fhir-conversion/msh";
import { buildHl7MessageFhirBundleFileKey } from "./hl7v2-to-fhir-conversion/shared";

dayjs.extend(duration);

const region = Config.getAWSRegion();

const supportedTypes = ["A01", "A03"];
const INTERNAL_HL7_ENDPOINT = `notification`;
const INTERNAL_PATIENT_ENDPOINT = "internal/patient";
const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

type Hl7ToFhirLambdaProps = {
  cxId: string;
  patientId: string;
  message: string;
  messageId: string;
  messageReceivedTimestamp: string;
  apiUrl?: string;
  bucketName?: string;
};

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function convertHl7MessageToFhirAndUpload({
  cxId,
  patientId,
  message,
  messageId,
  messageReceivedTimestamp,
  apiUrl,
  bucketName,
}: Hl7ToFhirLambdaProps): Promise<void> {
  const baseUrl = apiUrl || Config.getApiLoadBalancerAddress();
  const s3BucketName = bucketName || Config.getOutgoingHl7NotificationBucketName();

  const { log } = out(`Hl7 to FHIR Lambda - cx: ${cxId}, pt: ${patientId}`);
  log(`Converting message from ${messageReceivedTimestamp}`);

  const hl7Message = Hl7Message.parse(message);
  const s3Client = getS3UtilsInstance();
  const internalHl7RouteUrl = `${baseUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}/${INTERNAL_HL7_ENDPOINT}`;
  const internalGetPatientUrl = `${baseUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}?cxId=${cxId}`;

  const msgType = getHl7MessageTypeOrFail(hl7Message);
  if (!supportedTypes.includes(msgType.triggerEvent)) {
    log(`Message type ${msgType.triggerEvent} is not supported. Skipping...`);
    return;
  }

  const patient = await executeWithNetworkRetries(
    async () => await axios.get(internalGetPatientUrl)
  );
  const fhirPatient = toFhirPatient({ id: patientId, data: patient.data });

  const convertedBundle = convertHl7v2MessageToFhir({
    message: hl7Message,
    cxId,
    patientId,
    timestampString: messageReceivedTimestamp,
  });

  const bundle = saturateConvertedBundle({
    bundle: convertedBundle,
    fhirPatient,
  });

  const nonSpecificUploadParams: Omit<StoreInS3Params, "fileName" | "payload"> = {
    s3Utils: s3Client,
    bucketName: s3BucketName,
    contentType: JSON_APP_MIME_TYPE,
    log,
    errorConfig: {
      errorMessage: "Error uploading HL7 FHIR bundle to S3",
      context: "convertHl7MessageToFhirAndUpload",
      captureParams: {
        patientId,
        cxId,
        messageReceivedTimestamp,
      },
      shouldCapture: true,
    },
  };

  const newBundleFileName = buildHl7MessageFhirBundleFileKey({
    cxId,
    patientId,
    timestamp: messageReceivedTimestamp,
    messageId,
    messageCode: msgType.messageCode,
    triggerEvent: msgType.triggerEvent,
    extension: "hl7",
  });

  await storeInS3WithRetries({
    ...nonSpecificUploadParams,
    payload: JSON.stringify(bundle),
    fileName: newBundleFileName,
  });

  log(`Conversion complete, and result uploaded to S3. File: ${newBundleFileName}`);

  const bundlePresignedUrl = await s3Client.getSignedUrl({
    bucketName: s3BucketName,
    fileName: newBundleFileName,
    durationSeconds: SIGNED_URL_DURATION_SECONDS,
  });

  await executeWithNetworkRetries(
    async () =>
      await axios.post(internalHl7RouteUrl, undefined, {
        params: {
          cxId,
          triggerEvent: msgType.triggerEvent,
          presignedUrl: bundlePresignedUrl,
        },
      })
  );
  log(`Done. API notified...`);
}

function saturateConvertedBundle({
  bundle,
  fhirPatient,
}: {
  bundle: Bundle<Resource>;
  fhirPatient: Resource;
}): Bundle<Resource> {
  const fhirPatientEntry = buildBundleEntry(fhirPatient);
  const combinedEntries = bundle.entry ? [fhirPatientEntry, ...bundle.entry] : [];
  return buildBundle({ type: "collection", entries: combinedEntries });
}
