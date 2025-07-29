import { Hl7Message } from "@medplum/core";
import { Bundle, CodeableConcept, Resource } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { CreateDischargeRequeryParams } from "@metriport/shared/src/domain/patient/patient-monitoring/discharge-requery";
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
import { isSupportedTriggerEvent, SupportedTriggerEvent } from "./utils";

export const dischargeEventCode = "A03";

const INTERNAL_HL7_ENDPOINT = `notification`;
const INTERNAL_PATIENT_ENDPOINT = "internal/patient";
const DISCHARGE_REQUERY_ENDPOINT = "monitoring/discharge-requery";
const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

export class Hl7NotificationWebhookSenderDirect implements Hl7NotificationWebhookSender {
  private readonly context = "hl7-notification-wh-sender";

  constructor(
    private readonly apiUrl: string,
    private readonly s3Utils = new S3Utils(Config.getAWSRegion())
  ) {}

  /**
   * This methods handles HL7 notifications by executing the following steps (in order):
   * 1. Parse and convert the HL7 message to FHIR
   * 2. Persist the encounter to the database
   * 3. Save the FHIR bundle to S3
   * 4. Send a Discharge Requery job kickoff to the API
   * 5. Send webhook notification to the API
   *
   * @param params - The parameters for the HL7 message.
   * @returns - A promise that resolves when the message is sent to the API.
   */
  async execute(params: Hl7Notification): Promise<void> {
    const message = Hl7Message.parse(params.message);
    const { cxId, patientId, sourceTimestamp, messageReceivedTimestamp } = params;
    const encounterId = createEncounterId(message, patientId);
    const { log } = out(`${this.context}, cx: ${cxId}, pt: ${patientId}, enc: ${encounterId}`);

    const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(message);
    if (!isSupportedTriggerEvent(triggerEvent)) {
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
    const internalDischargeRequeryRouteUrl = `${this.apiUrl}/${INTERNAL_PATIENT_ENDPOINT}/${DISCHARGE_REQUERY_ENDPOINT}`;

    log(`GET internalGetPatientUrl: ${internalGetPatientUrl}`);
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

    const clinicalInformation = this.extractClinicalInformation(newEncounterData);

    log(`Writing TCM encounter to DB...`);
    await this.persistTcmEncounter(
      {
        id: encounterId,
        cxId,
        patientId,
        class: encounterClass.display,
        facilityName: facilityName,
        admitTime: encounterPeriod?.start,
        dischargeTime: encounterPeriod?.end,
        clinicalInformation,
      },
      triggerEvent
    );

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

    log(`Sending Discharge Requery kickoff...`);
    if (triggerEvent === dischargeEventCode) {
      const params: CreateDischargeRequeryParams = {
        cxId,
        patientId,
      };
      await executeWithNetworkRetries(
        async () =>
          await axios.post(internalDischargeRequeryRouteUrl, undefined, {
            params,
          })
      );
    }

    const bundlePresignedUrl = await this.s3Utils.getSignedUrl({
      bucketName: result.bucket,
      fileName: result.key,
      versionId: result.versionId,
      durationSeconds: SIGNED_URL_DURATION_SECONDS,
    });

    log(`Calling Hl7 notification callback endpoint in API...`);
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

    log(`Done. API notified...`);
  }

  private async persistTcmEncounter(
    tcmEncounterPayload: {
      id: string;
      cxId: string;
      patientId: string;
      class: string | undefined;
      facilityName: string | undefined;
      admitTime: string | undefined;
      dischargeTime: string | undefined;
      clinicalInformation: Record<string, unknown>;
    },
    triggerEvent: SupportedTriggerEvent
  ) {
    const { admitTime, dischargeTime, ...basePayload } = tcmEncounterPayload;
    const encounterId = basePayload.id;
    const latestEvent = triggerEvent === "A01" ? "Admitted" : "Discharged";
    const fullPayload = {
      ...basePayload,
      latestEvent,
      ...(admitTime ? { admitTime } : undefined),
      ...(dischargeTime ? { dischargeTime } : undefined),
    };

    const { log } = out(
      `persistTcmEncounter, cx: ${tcmEncounterPayload.cxId}, pt: ${tcmEncounterPayload.patientId}, enc: ${encounterId}`
    );

    log(`PUT /internal/tcm/encounter ${triggerEvent}`);
    await executeWithNetworkRetries(
      async () => axios.put(`${this.apiUrl}/internal/tcm/encounter/`, fullPayload),
      {
        log,
      }
    );
  }

  private extractClinicalInformation(bundle: Bundle<Resource>): {
    condition: Array<CodeableConcept>;
  } {
    const conditions: Array<CodeableConcept> = [];

    if (bundle.entry) {
      for (const entry of bundle.entry) {
        if (entry.resource?.resourceType === "Condition" && entry.resource.code?.coding) {
          conditions.push({
            coding:
              entry.resource.code?.coding?.map(coding => ({
                code: coding.code ?? "",
                display: coding.display ?? "",
                system: coding.system ?? "",
              })) ?? [],
          });
        }
      }
    }

    return { condition: conditions };
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
