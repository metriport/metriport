import { Hl7Message } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { errorToString, executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { S3Utils, StoreInS3Params, storeInS3WithRetries } from "../../external/aws/s3";
import { deduplicate } from "../../external/fhir/consolidated/deduplicate";
import { toFHIR as toFhirPatient } from "../../external/fhir/patient/conversion";
import { buildBundle, buildBundleEntry } from "../../external/fhir/shared/bundle";
import { capture, out } from "../../util";
import { Config } from "../../util/config";
import { JSON_APP_MIME_TYPE } from "../../util/mime";
import { convertHl7v2MessageToFhir } from "./hl7v2-to-fhir-conversion";
import { Hl7MessageType, getHl7MessageTypeOrFail } from "./hl7v2-to-fhir-conversion/msh";
import {
  buildHl7MessageCombinedBundleFileKey,
  buildHl7MessageFhirBundleFileKey,
} from "./hl7v2-to-fhir-conversion/shared";

dayjs.extend(duration);

const region = Config.getAWSRegion();

// TODO 2887: Add more event types to both arrays
const createMessageTypes = ["A01"];
const updateMessageTypes = ["A03"];

const INTERNAL_HL7_ENDPOINT = `internal/hl7`;
const INTERNAL_GET_PATIENT_ENDPOINT = "internal/patient";
const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

type Hl7ToFhirLambdaProps = {
  cxId: string;
  patientId: string;
  message: string;
  messageId: string;
  messageReceivedTimestamp: string;
  apiUrl: string;
  bucketName: string;
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
  const { log } = out(`Hl7 to FHIR Lambda - cx: ${cxId}, pt: ${patientId}`);
  log(`Running message from ${messageReceivedTimestamp}`);
  const hl7Message = Hl7Message.parse(message);
  const s3Client = getS3UtilsInstance();
  const internalHl7RouteUrl = `${apiUrl}/${INTERNAL_HL7_ENDPOINT}`;
  const internalGetPatientUrl = `${apiUrl}/${INTERNAL_GET_PATIENT_ENDPOINT}/${patientId}?cxId=${cxId}`;

  const convertedBundle = convertHl7v2MessageToFhir({
    hl7Message,
    cxId,
    patientId,
    messageId,
    timestampString: messageReceivedTimestamp,
  });

  const newBundle = await saturateConvertedBundle({
    bundle: convertedBundle,
    patientId,
    cxId,
    messageId,
    messageReceivedTimestamp,
    internalGetPatientUrl,
    log,
  });

  const sharedUploadParams: Omit<StoreInS3Params, "fileName" | "payload"> = {
    s3Utils: s3Client,
    bucketName,
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

  const msgType = getHl7MessageTypeOrFail(hl7Message);
  const newBundleFileName = buildHl7MessageFhirBundleFileKey({
    cxId,
    patientId,
    timestamp: messageReceivedTimestamp,
    messageId,
    messageType: msgType.messageType,
    messageCode: msgType.triggerEvent,
  });

  const newBundleUploadPromise = storeInS3WithRetries({
    ...sharedUploadParams,
    payload: JSON.stringify(newBundle),
    fileName: newBundleFileName,
  });

  const combinedBundleFileName = buildHl7MessageCombinedBundleFileKey(cxId, patientId);
  let combinedBundle = newBundle;
  try {
    const existingCombinedBundleRaw = await s3Client.downloadFile({
      bucket: bucketName,
      key: combinedBundleFileName,
    });
    const existingBundle = JSON.parse(JSON.stringify(existingCombinedBundleRaw));
    combinedBundle = existingBundle;

    if (createMessageTypes.includes(msgType.triggerEvent)) {
      const mergedBundle = await mergeIncomingBundleIntoCombined({
        cxId,
        patientId,
        existingBundle,
        incomingBundle: newBundle,
        log,
      });
      combinedBundle = mergedBundle;
    } else if (updateMessageTypes.includes(msgType.triggerEvent)) {
      // For update messages, we need to retrieve and update it before sending to the API
      log("Need to retrieve and update existing entries");
      return;
    } else {
      log(`Not handling this message type yet: ${msgType.triggerEvent}`);
      // TODO: Think of what to do here
    }
  } catch (err) {
    log(`No existing combined bundle found. Creating a new one.`);
    // intentionally not throwing
  }

  const combinedBundleUploadPromise = storeInS3WithRetries({
    ...sharedUploadParams,
    payload: JSON.stringify(combinedBundle),
    fileName: combinedBundleFileName,
    ...(sharedUploadParams.errorConfig
      ? {
          errorConfig: {
            ...sharedUploadParams.errorConfig,
            errorMessage: "Error uploading updated HL7 Combined FHIR bundle to S3",
          },
        }
      : undefined),
  });

  const bundlePresignedUrlPromise = getPresignedUrl({
    s3Client,
    bucketName,
    fileName: newBundleFileName,
    cxId,
    messageId,
    timestamp: messageReceivedTimestamp,
    messageType: msgType,
    patientId,
    log,
  });
  const [, , bundlePresignedUrl] = await Promise.all([
    newBundleUploadPromise,
    combinedBundleUploadPromise,
    bundlePresignedUrlPromise,
  ]);

  try {
    await executeWithNetworkRetries(
      async () =>
        await axios.post(internalHl7RouteUrl, undefined, {
          params: {
            cxId,
            patientId,
            presignedUrl: bundlePresignedUrl,
          },
        })
    );
    log(`Successfully sent HL7 FHIR bundle to ${internalHl7RouteUrl}`);
    return;
  } catch (err) {
    log(`Error hitting the ${INTERNAL_HL7_ENDPOINT} endpoint: - ${errorToString(err)}`);
    throw err;
  }
}

async function saturateConvertedBundle({
  bundle,
  patientId,
  cxId,
  messageId,
  messageReceivedTimestamp,
  internalGetPatientUrl,
  log,
}: {
  bundle: Bundle<Resource>;
  patientId: string;
  cxId: string;
  messageId: string;
  messageReceivedTimestamp: string;
  internalGetPatientUrl: string;
  log: typeof console.log;
}) {
  try {
    const patient = await executeWithNetworkRetries(
      async () => await axios.get(internalGetPatientUrl)
    );
    const fhirPatient = toFhirPatient({ id: patientId, data: patient.data });
    const fhirPatientEntry = buildBundleEntry(fhirPatient);
    const combinedEntries = bundle.entry ? [fhirPatientEntry, ...bundle.entry] : [];
    return buildBundle({ type: "collection", entries: combinedEntries });
  } catch (error) {
    const msg = "Error retrieving patient data on HL7-to-FHIR conversion";
    log(`${msg}: ${errorToString(error)}`);
    capture.message(msg, {
      extra: {
        patientId,
        cxId,
        messageId,
        timestamp: messageReceivedTimestamp,
      },
    });

    throw error;
  }
}

async function mergeIncomingBundleIntoCombined({
  cxId,
  patientId,
  existingBundle,
  incomingBundle,
  log,
}: {
  cxId: string;
  patientId: string;
  existingBundle: Bundle<Resource>;
  incomingBundle: Bundle<Resource>;
  log: typeof console.log;
}) {
  const combinedEntries = [...(existingBundle.entry || []), ...(incomingBundle.entry || [])];
  const combinedBundle = buildBundle({
    type: "collection",
    entries: combinedEntries,
  });

  const dedupedCombinedBundle = await deduplicate({
    cxId,
    patientId,
    bundle: combinedBundle,
  });
  log(`Combined and deduped the incoming bundle with the existing one.`);

  return dedupedCombinedBundle;
}

async function getPresignedUrl({
  s3Client,
  bucketName,
  fileName,
  cxId,
  messageId,
  timestamp,
  messageType,
  patientId,
  log,
}: {
  s3Client: S3Utils;
  bucketName: string;
  fileName: string;
  cxId: string;
  messageId: string;
  timestamp: string;
  messageType: Hl7MessageType;
  patientId: string;
  log: typeof console.log;
}): Promise<string> {
  try {
    const bundlePresignedUrl = await s3Client.getSignedUrl({
      bucketName,
      fileName,
      durationSeconds: SIGNED_URL_DURATION_SECONDS,
    });
    return bundlePresignedUrl;
  } catch (error) {
    const msg = "Error generating presigned URL for HL7 FHIR bundle";
    log(`${msg}: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        patientId,
        cxId,
        messageId,
        timestamp,
        messageType,
      },
    });
    throw error;
  }
}
