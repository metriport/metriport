import { Hl7Message } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import { S3Utils, StoreInS3Params, storeInS3WithRetries } from "../../external/aws/s3";
import { toFHIR as toFhirPatient } from "../../external/fhir/patient/conversion";
import { buildBundle, buildBundleEntry } from "../../external/fhir/shared/bundle";
import { out } from "../../util";
import { Config } from "../../util/config";
import { JSON_APP_MIME_TYPE } from "../../util/mime";
import { convertHl7v2MessageToFhir } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion";
import {
  getHl7MessageTypeOrFail,
  getMessageUniqueIdentifier,
} from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import { buildHl7MessageFhirBundleFileKey } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { Hl7Notification, Hl7NotificationWebhookSender } from "./hl7-notification-webhook-sender";

const supportedTypes = ["A01", "A03"];
const INTERNAL_HL7_ENDPOINT = `notification`;
const INTERNAL_PATIENT_ENDPOINT = "internal/patient";
const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

export class Hl7NotificationWebhookSenderDirect implements Hl7NotificationWebhookSender {
  private readonly context = "hl7-notification-wh-sender";
  private readonly s3Utils: S3Utils;

  constructor() {
    this.s3Utils = new S3Utils(Config.getAWSRegion());
  }

  async execute(params: Hl7Notification): Promise<void> {
    const hl7Message = Hl7Message.parse(params.message);
    const { cxId, patientId, messageReceivedTimestamp, apiUrl, bucketName } = params;
    const { log } = out(`${this.context}, cx: ${cxId}, pt: ${patientId}`);

    const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(hl7Message);
    if (!supportedTypes.includes(triggerEvent)) {
      log(`Trigger event ${triggerEvent} is not supported. Skipping...`);
      return;
    }

    const baseUrl = apiUrl || Config.getApiLoadBalancerAddress();
    const s3BucketName = bucketName || Config.getHl7OutgoingMessageBucketName();
    const internalHl7RouteUrl = `${baseUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}/${INTERNAL_HL7_ENDPOINT}`;
    const internalGetPatientUrl = `${baseUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}?cxId=${cxId}`;

    const patient = await executeWithNetworkRetries(
      async () => await axios.get(internalGetPatientUrl)
    );
    const fhirPatient = toFhirPatient({ id: patientId, data: patient.data });

    const conversionResult = convertHl7v2MessageToFhir({
      message: hl7Message,
      cxId,
      patientId,
      timestampString: messageReceivedTimestamp,
    });

    const bundle = saturateConvertedBundle({
      bundle: conversionResult,
      fhirPatient,
    });
    log(`Conversion complete and patient entry added`);

    const nonSpecificUploadParams: Omit<StoreInS3Params, "fileName" | "payload"> = {
      s3Utils: this.s3Utils,
      bucketName: s3BucketName,
      contentType: JSON_APP_MIME_TYPE,
      log,
      errorConfig: {
        errorMessage: "Error uploading HL7 FHIR bundle to S3",
        context: this.context,
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
      messageId: getMessageUniqueIdentifier(hl7Message),
      messageCode: messageCode,
      triggerEvent: triggerEvent,
    });

    await storeInS3WithRetries({
      ...nonSpecificUploadParams,
      payload: JSON.stringify(bundle),
      fileName: newBundleFileName,
    });
    log(`Uploaded to S3. Filepath: ${newBundleFileName}`);

    const bundlePresignedUrl = await this.s3Utils.getSignedUrl({
      bucketName: s3BucketName,
      fileName: newBundleFileName,
      durationSeconds: SIGNED_URL_DURATION_SECONDS,
    });

    await executeWithNetworkRetries(
      async () =>
        await axios.post(internalHl7RouteUrl, undefined, {
          params: {
            cxId,
            triggerEvent,
            presignedUrl: bundlePresignedUrl,
          },
        })
    );
    log(`Done. API notified...`);
  }
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
