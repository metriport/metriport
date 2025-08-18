import { Hl7Message } from "@medplum/core";
import { Bundle, CodeableConcept, Period, Resource } from "@medplum/fhirtypes";
import { executeWithNetworkRetries } from "@metriport/shared";
import { DischargeData } from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import { TcmEncounterUpsertInput } from "@metriport/shared/domain/tcm-encounter";
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
import {
  Hl7NotificationSenderParams,
  Hl7NotificationWebhookSender,
} from "./hl7-notification-webhook-sender";
import { isSupportedTriggerEvent, SupportedTriggerEvent } from "./utils";

export const dischargeEventCode = "A03";

const INTERNAL_HL7_ENDPOINT = `notification`;
const INTERNAL_PATIENT_ENDPOINT = "internal/patient";
const DISCHARGE_REQUERY_ENDPOINT = "monitoring/discharge-requery";
const SIGNED_URL_DURATION_SECONDS = dayjs.duration({ minutes: 10 }).asSeconds();

type ClinicalInformation = {
  condition: Array<CodeableConcept>;
  encounterReason: Array<CodeableConcept>;
};

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
  async execute(params: Hl7NotificationSenderParams): Promise<void> {
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

    log(`GET internalGetPatientUrl: ${internalGetPatientUrl}`);
    const patient = await executeWithNetworkRetries(
      async () => await axios.get(internalGetPatientUrl)
    );
    const fhirPatient = toFhirPatient({ id: patientId, data: patient.data });

    const conversionResult = convertHl7v2MessageToFhir({
      message,
      cxId,
      patientId,
      rawDataFileKey: params.rawDataFileKey,
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

    await this.createDischargeRequeryJob(cxId, patientId, encounterPeriod, triggerEvent, log);

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
    const fullPayload: TcmEncounterUpsertInput = {
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

  private async createDischargeRequeryJob(
    cxId: string,
    patientId: string,
    encounterPeriod: Period | undefined,
    triggerEvent: SupportedTriggerEvent,
    log: typeof console.log
  ): Promise<void> {
    if (triggerEvent !== dischargeEventCode) return;

    const dischargeData: DischargeData[] = encounterPeriod?.end
      ? [{ type: "findDischargeSummary", encounterEndDate: encounterPeriod.end }]
      : [];

    log(`Sending Discharge Requery kickoff...`);
    const createDischargeRequeryJobRouteUrl = `${this.apiUrl}/${INTERNAL_PATIENT_ENDPOINT}/${DISCHARGE_REQUERY_ENDPOINT}`;

    await executeWithNetworkRetries(
      async () =>
        axios.post(
          createDischargeRequeryJobRouteUrl,
          { dischargeData },
          { params: { cxId, patientId } }
        ),
      {
        log,
      }
    );
    return;
  }

  private extractClinicalInformation(bundle: Bundle<Resource>): ClinicalInformation {
    const clinicalInformation: ClinicalInformation = {
      condition: [],
      encounterReason: [],
    };

    if (bundle.entry) {
      for (const entry of bundle.entry) {
        if (entry.resource?.resourceType === "Condition" && entry.resource.code?.coding) {
          clinicalInformation.condition.push({
            coding:
              entry.resource.code?.coding?.map(coding => ({
                code: coding.code ?? "",
                display: coding.display ?? "",
                system: coding.system ?? "",
              })) ?? [],
          });
        } else if (entry.resource?.resourceType === "Encounter") {
          clinicalInformation.encounterReason = entry.resource.reasonCode ?? [];
        }
      }
    }

    return clinicalInformation;
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
