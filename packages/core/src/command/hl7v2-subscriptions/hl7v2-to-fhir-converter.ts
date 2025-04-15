import { Hl7Message } from "@medplum/core";
import { errorToString, executeWithNetworkRetries } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Hl7v2Subscription } from "../../domain/patient-settings";
import { S3Utils, storeInS3WithRetries } from "../../external/aws/s3";
import { toFHIR as toFhirPatient } from "../../external/fhir/patient/conversion";
import { buildBundle, buildBundleEntry } from "../../external/fhir/shared/bundle";
import { out } from "../../util";
import { Config } from "../../util/config";
import { CSV_FILE_EXTENSION, JSON_APP_MIME_TYPE } from "../../util/mime";
import { convertHl7v2MessageToFhir } from "./hl7v2-to-fhir-conversion";
import { getHl7MessageIdentifierOrFail } from "./hl7v2-to-fhir-conversion/msh";
import { buildHl7MessageFhirBundleFileKey } from "./hl7v2-to-fhir-conversion/shared";

dayjs.extend(duration);

const region = Config.getAWSRegion();

// TODO 2887: Add more event types to both arrays
const createMessageTypes = ["A01"];
const updateMessageTypes = ["A03", "A08"];

const INTERNAL_HL7_ENDPOINT = `internal/hl7`;
const INTERNAL_GET_PATIENT_ENDPOINT = "internal/patient";
const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

type Hl7ToFhirLambdaProps = {
  cxId: string;
  patientId: string;
  message: string;
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
    timestampString: messageReceivedTimestamp,
  });

  const patient = await executeWithNetworkRetries(
    async () => await axios.get(internalGetPatientUrl)
  );
  const fhirPatient = toFhirPatient({ id: patientId, data: patient.data });
  const fhirPatientEntry = buildBundleEntry(fhirPatient);
  const combinedEntries = fhirBundle.entry ? [fhirPatientEntry, ...fhirBundle.entry] : [];
  const fullBundle = buildBundle({ type: "collection", entries: combinedEntries });

  const msgIdentifier = getHl7MessageIdentifierOrFail(hl7Message);

  // For create messages, we send the FHIR bundle directly to the API
  if (createMessageTypes.includes(msgIdentifier.triggerEvent)) {
    const bundleFileName = buildHl7MessageFhirBundleFileKey({
      cxId,
      patientId,
      timestamp: messageReceivedTimestamp,
      messageType: msgIdentifier.messageType,
      messageCode: msgIdentifier.triggerEvent,
    });

    await storeInS3WithRetries({
      s3Utils: s3Client,
      payload: JSON.stringify(fullBundle),
      bucketName,
      fileName: bundleFileName,
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
    });

    const bundlePresignedUrl = await s3Client.getSignedUrl({
      bucketName,
      fileName: bundleFileName,
      durationSeconds: SIGNED_URL_DURATION_SECONDS,
    });

    try {
      await executeWithNetworkRetries(
        async () =>
          await axios.post(
            internalHl7RouteUrl,
            { url: bundlePresignedUrl },
            {
              params: {
                cxId,
                patientId,
              },
            }
          )
      );
    } catch (err) {
      log(`Error hitting the ${INTERNAL_HL7_ENDPOINT} endpoint: - ${errorToString(err)}`);
      throw err;
    }

    log(`Successfully sent HL7 FHIR bundle to ${internalHl7RouteUrl}`);
    return;
  }

  // For update messages, we need to retrieve and update it before sending to the API
  if (updateMessageTypes.includes(msgIdentifier.triggerEvent)) {
    // TODO 2883: Implement this functionality
    console.log("Need to retrieve and update existing entries");
    return;
  }

  log("Unexpected message type: ", msgIdentifier.triggerEvent);
  return;
}

export function buildDocumentNameForHl7v2Roster(
  hieName: string,
  subscriptions: Hl7v2Subscription[]
): string {
  const todaysDate = buildDayjs(new Date()).toISOString().split("T")[0];
  return `${todaysDate}/${hieName}/${subscriptions.join("-")}${CSV_FILE_EXTENSION}`;
}
