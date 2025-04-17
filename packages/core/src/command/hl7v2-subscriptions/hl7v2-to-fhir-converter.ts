import { Hl7Message } from "@medplum/core";
import { errorToString, executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { S3Utils, StoreInS3Params, storeInS3WithRetries } from "../../external/aws/s3";
import { deduplicate } from "../../external/fhir/consolidated/deduplicate";
import { toFHIR as toFhirPatient } from "../../external/fhir/patient/conversion";
import { buildBundle, buildBundleEntry } from "../../external/fhir/shared/bundle";
import { out } from "../../util";
import { Config } from "../../util/config";
import { JSON_APP_MIME_TYPE } from "../../util/mime";
import { convertHl7v2MessageToFhir } from "./hl7v2-to-fhir-conversion";
import { getHl7MessageTypeOrFail } from "./hl7v2-to-fhir-conversion/msh";
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

  const fhirBundle = convertHl7v2MessageToFhir({
    hl7Message,
    cxId,
    patientId,
    messageId,
    timestampString: messageReceivedTimestamp,
  });

  const patient = await executeWithNetworkRetries(
    async () => await axios.get(internalGetPatientUrl)
  );
  const fhirPatient = toFhirPatient({ id: patientId, data: patient.data });
  const fhirPatientEntry = buildBundleEntry(fhirPatient);
  const combinedEntries = fhirBundle.entry ? [fhirPatientEntry, ...fhirBundle.entry] : [];
  const fullBundle = buildBundle({ type: "collection", entries: combinedEntries });

  const msgType = getHl7MessageTypeOrFail(hl7Message);

  const combinedBundleFileName = buildHl7MessageCombinedBundleFileKey(cxId, patientId);
  const bundleFileName = buildHl7MessageFhirBundleFileKey({
    cxId,
    patientId,
    timestamp: messageReceivedTimestamp,
    messageId,
    messageType: msgType.messageType,
    messageCode: msgType.triggerEvent,
  });

  // For create messages, we send the FHIR bundle directly to the API
  if (createMessageTypes.includes(msgType.triggerEvent)) {
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

    const newBundleUploadPromise = storeInS3WithRetries({
      ...sharedUploadParams,
      payload: JSON.stringify(fullBundle),
      fileName: bundleFileName,
    });

    let combinedBundle = fullBundle;
    try {
      const existingCombinedBundle = await s3Client.downloadFile({
        bucket: bucketName,
        key: combinedBundleFileName,
      });

      // If we found an existing bundle, combine it with the new one
      const existingBundle = JSON.parse(existingCombinedBundle.toString());
      const combinedEntries = [...(existingBundle.entry || []), ...(fullBundle.entry || [])];
      const updatedCombinedBundle = buildBundle({
        type: "collection",
        entries: combinedEntries,
      });

      combinedBundle = await deduplicate({ cxId, patientId, bundle: updatedCombinedBundle });
    } catch (err) {
      log(`No existing bundle found. Creating a new combined bundle`);
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

    await Promise.all([newBundleUploadPromise, combinedBundleUploadPromise]);

    const bundlePresignedUrl = await s3Client.getSignedUrl({
      bucketName,
      fileName: bundleFileName,
      durationSeconds: SIGNED_URL_DURATION_SECONDS,
    });

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
    } catch (err) {
      log(`Error hitting the ${INTERNAL_HL7_ENDPOINT} endpoint: - ${errorToString(err)}`);
      throw err;
    }

    log(`Successfully sent HL7 FHIR bundle to ${internalHl7RouteUrl}`);
    return;
  }

  // For update messages, we need to retrieve and update it before sending to the API
  if (updateMessageTypes.includes(msgType.triggerEvent)) {
    // TODO 2883: Implement this functionality
    console.log("Need to retrieve and update existing entries");
    return;
  }

  log("Unexpected message type: ", msgType.triggerEvent);
  return;
}
