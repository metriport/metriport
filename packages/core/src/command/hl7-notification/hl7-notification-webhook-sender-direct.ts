import { Hl7Message } from "@medplum/core";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import { S3Utils } from "../../external/aws/s3";
import {
  mergeBundleIntoAdtSourcedEncounter,
  saveAdtConversionBundle,
} from "../../external/fhir/adt-encounters";
import { buildBundleEntry, buildCollectionBundle } from "../../external/fhir/bundle/bundle";
import { toFHIR as toFhirPatient } from "../../external/fhir/patient/conversion";
import { capture, out } from "../../util";
import { Config } from "../../util/config";
import { convertHl7v2MessageToFhir } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion";
import { getEncounterClass } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/adt/encounter";
import {
  createEncounterId,
  getEncounterPeriod,
  getFacilityName,
} from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/adt/utils";
import {
  getHl7MessageTypeOrFail,
  getMessageUniqueIdentifier,
} from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import { Hl7Notification, Hl7NotificationWebhookSender } from "./hl7-notification-webhook-sender";

const supportedTypes = ["A01", "A03"];
const INTERNAL_HL7_ENDPOINT = `notification`;
const INTERNAL_PATIENT_ENDPOINT = "internal/patient";
const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

export class Hl7NotificationWebhookSenderDirect implements Hl7NotificationWebhookSender {
  private readonly context = "hl7-notification-wh-sender";

  constructor(
    private readonly apiUrl: string,
    private readonly s3Utils = new S3Utils(Config.getAWSRegion())
  ) {}

  async execute(params: Hl7Notification): Promise<void> {
    const message = Hl7Message.parse(params.message);
    const { cxId, patientId, sourceTimestamp, messageReceivedTimestamp } = params;
    const encounterId = createEncounterId(message, patientId);
    const { log } = out(`${this.context}, cx: ${cxId}, pt: ${patientId}, enc: ${encounterId}`);

    const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(message);
    if (!supportedTypes.includes(triggerEvent)) {
      log(`Trigger event ${triggerEvent} is not supported. Skipping...`);
      return;
    }

    const encounterPeriod = getEncounterPeriod(message);
    const encounterClass = getEncounterClass(message);
    const facilityName = getFacilityName(message);

    capture.setExtra({
      cxId,
      patientId,
      encounterId,
      sourceTimestamp,
      messageReceivedTimestamp,
      messageCode,
      triggerEvent,
      facilityName,
      encounterClass,
      encounterPeriod,
    });

    const internalHl7RouteUrl = `${this.apiUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}/${INTERNAL_HL7_ENDPOINT}`;
    const internalGetPatientUrl = `${this.apiUrl}/${INTERNAL_PATIENT_ENDPOINT}/${patientId}?cxId=${cxId}`;

    log(`Writing TCM encounter to DB...`);
    await this.writeTcmEncounterToDb(
      {
        id: encounterId,
        cxId,
        patientId,
        class: encounterClass.display,
        facilityName,
        admitTime: encounterPeriod?.start,
        dischargeTime: encounterPeriod?.end,
      },
      triggerEvent as "A01" | "A03"
    );

    log(`Creating FHIR bundle`);
    log(`internalGetPatientUrl: ${internalGetPatientUrl}`);
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

    const newEncounterData = prependPatientToBundle({
      bundle: conversionResult,
      fhirPatient,
    });
    log(`Conversion complete and patient entry added`);

    log(`Updating encounter bundle in S3...`);
    const [, result] = await Promise.all([
      saveAdtConversionBundle({
        cxId,
        patientId,
        encounterId,
        timestamp: sourceTimestamp,
        messageId: getMessageUniqueIdentifier(message),
        messageCode,
        triggerEvent,
        bundle: newEncounterData,
        context: this.context,
        s3Utils: this.s3Utils,
      }),
      mergeBundleIntoAdtSourcedEncounter({
        cxId,
        patientId,
        encounterId,
        newEncounterData,
      }),
    ]);

    const bundlePresignedUrl = await this.s3Utils.getSignedUrl({
      bucketName: result.bucket,
      fileName: result.key,
      versionId: result.versionId,
      durationSeconds: SIGNED_URL_DURATION_SECONDS,
    });

    log(`Sending HL7 notification to API...`);
    await executeWithNetworkRetries(
      async () =>
        await axios.post(internalHl7RouteUrl, undefined, {
          params: {
            cxId,
            triggerEvent,
            presignedUrl: bundlePresignedUrl,
            ...(encounterPeriod?.start ? { admitTimestamp: encounterPeriod.start } : undefined),
            ...(encounterPeriod?.end ? { dischargeTimestamp: encounterPeriod.end } : undefined),
            whenSourceSent: messageReceivedTimestamp,
          },
        })
    );

    log(`Done.`);
  }

  private async writeTcmEncounterToDb(
    tcmEncounterPayload: {
      id: string;
      cxId: string;
      patientId: string;
      class: string | undefined;
      facilityName: string | undefined;
      admitTime: string | undefined;
      dischargeTime: string | undefined;
    },
    triggerEvent: "A01" | "A03"
  ) {
    const encounterId = tcmEncounterPayload.id;
    const admitTime = tcmEncounterPayload.admitTime;
    const dischargeTime = tcmEncounterPayload.dischargeTime;
    const { log } = out(
      `writeTcmEncounterToDb, cx: ${tcmEncounterPayload.cxId}, pt: ${tcmEncounterPayload.patientId}, enc: ${encounterId}`
    );
    /**
     * TODO:
     * We frequently receive "duplicate" ADTs - different messages with the same data for the same event.
     * We need to deduplicate them to avoid noisy creation errors.
     */
    if (triggerEvent === "A01") {
      log(`POST /internal/tcm/encounter/ A01`);
      await executeWithNetworkRetries(
        async () =>
          axios.post(`${this.apiUrl}/internal/tcm/encounter/`, {
            ...tcmEncounterPayload,
            id: encounterId,
            latestEvent: "Admitted",
          }),
        {
          log,
        }
      );
    } else if (triggerEvent === "A03") {
      try {
        log(`PUT /medical/v1/tcm/encounter/${encounterId} A03`);
        await executeWithNetworkRetries(
          async () =>
            axios.put(`${this.apiUrl}/medical/v1/tcm/encounter/${encounterId}`, {
              ...tcmEncounterPayload,
              latestEvent: "Discharged",
              admitTime,
              dischargeTime,
            }),
          {
            log,
          }
        );
      } catch (error) {
        log(`POST /internal/tcm/encounter/ A03`);
        await executeWithNetworkRetries(
          async () =>
            axios.post(`${this.apiUrl}/internal/tcm/encounter/`, {
              ...tcmEncounterPayload,
              id: encounterId,
              latestEvent: "Discharged",
              admitTime,
              dischargeTime,
            }),
          {
            log,
          }
        );
      }
    }
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
  return buildCollectionBundle(combinedEntries);
}
