import { Hl7Message } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import { S3Utils, storeInS3WithRetries } from "../../external/aws/s3";
import { toFHIR as toFhirPatient } from "../../external/fhir/patient/conversion";
import { buildBundle, buildBundleEntry } from "../../external/fhir/shared/bundle";
import { out } from "../../util";
import { Config } from "../../util/config";
import { JSON_APP_MIME_TYPE } from "../../util/mime";
import { convertHl7v2MessageToFhir } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion";
import { getEncounterPeriod } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/adt/utils";
import {
  getHl7MessageTypeOrFail,
  getMessageUniqueIdentifier,
} from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import {
  buildHl7MessageConversionFileKey,
  buildHl7MessageFhirBundleFileKey,
} from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { Hl7Notification, Hl7NotificationWebhookSender } from "./hl7-notification-webhook-sender";

const supportedTypes = ["A01", "A03"];
const INTERNAL_HL7_ENDPOINT = `notification`;
const INTERNAL_PATIENT_ENDPOINT = "internal/patient";
const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

export class Hl7NotificationWebhookSenderDirect implements Hl7NotificationWebhookSender {
  private readonly context = "hl7-notification-wh-sender";

  constructor(
    private readonly apiUrl: string,
    private readonly oldBucketName: string,
    private readonly bucketName: string,
    private readonly s3Utils = new S3Utils(Config.getAWSRegion())
  ) {}

  async execute(params: Hl7Notification): Promise<void> {
    const message = Hl7Message.parse(params.message);
    const { cxId, patientId, sourceTimestamp, messageReceivedTimestamp } = params;
    const { log } = out(`${this.context}, cx: ${cxId}, pt: ${patientId}`);

    const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(message);
    if (!supportedTypes.includes(triggerEvent)) {
      log(`Trigger event ${triggerEvent} is not supported. Skipping...`);
      return;
    }

    const internalHl7RouteUrl = `${this.apiUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}/${INTERNAL_HL7_ENDPOINT}`;
    const internalGetPatientUrl = `${this.apiUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}?cxId=${cxId}`;

    const patient = await executeWithNetworkRetries(
      async () => await axios.get(internalGetPatientUrl)
    );
    const fhirPatient = toFhirPatient({ id: patientId, data: patient.data });

    const conversionResult = convertHl7v2MessageToFhir({
      message,
      cxId,
      patientId,
      timestampString: sourceTimestamp,
    });

    const bundle = prependPatientToBundle({
      bundle: conversionResult,
      fhirPatient,
    });
    log(`Conversion complete and patient entry added`);

    const nonSpecificUploadParams = {
      s3Utils: this.s3Utils,
      contentType: JSON_APP_MIME_TYPE,
      log,
      errorConfig: {
        errorMessage: "Error uploading HL7 FHIR bundle to S3",
        context: this.context,
        captureParams: {
          patientId,
          cxId,
          sourceTimestamp,
        },
        shouldCapture: true,
      },
    };

    // TODO(lucas|ENG-257|2025-05-15): Remove this once new bucket flow is working correctly
    // Upload to old bucket
    const oldBundleFilename = buildHl7MessageFhirBundleFileKey({
      cxId,
      patientId,
      timestamp: sourceTimestamp,
      messageId: getMessageUniqueIdentifier(message),
      messageCode,
      triggerEvent,
    });
    await storeInS3WithRetries({
      ...nonSpecificUploadParams,
      bucketName: this.oldBucketName,
      payload: JSON.stringify(bundle),
      fileName: oldBundleFilename,
    });
    log(`Uploaded to S3 bucket: ${this.oldBucketName}. Filepath: ${oldBundleFilename}`);

    // Upload to new bucket
    const newBundleFilename = buildHl7MessageConversionFileKey({
      cxId,
      patientId,
      timestamp: sourceTimestamp,
      messageId: getMessageUniqueIdentifier(message),
      messageCode,
      triggerEvent,
    });

    await storeInS3WithRetries({
      ...nonSpecificUploadParams,
      bucketName: this.bucketName,
      payload: JSON.stringify(bundle),
      fileName: newBundleFilename,
    });
    log(`Uploaded to S3 bucket: ${this.bucketName}. Filepath: ${newBundleFilename}`);

    // TODO(lucas|ENG-257|2025-05-15): Generate latest.hl7.json and use it for presigned url
    const oldBundlePresignedUrl = await this.s3Utils.getSignedUrl({
      bucketName: this.oldBucketName,
      fileName: oldBundleFilename,
      durationSeconds: SIGNED_URL_DURATION_SECONDS,
    });

    const encounterPeriod = getEncounterPeriod(message);
    await executeWithNetworkRetries(
      async () =>
        await axios.post(internalHl7RouteUrl, undefined, {
          params: {
            cxId,
            triggerEvent,
            presignedUrl: oldBundlePresignedUrl,
            ...(encounterPeriod?.start ? { admitTimestamp: encounterPeriod.start } : undefined),
            ...(encounterPeriod?.end ? { dischargeTimestamp: encounterPeriod.end } : undefined),
            whenSourceSent: messageReceivedTimestamp,
          },
        })
    );
    log(`Done. API notified...`);
  }
}

function prependPatientToBundle({
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
