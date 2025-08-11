import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import {
  CodeableConcept,
  Coding,
  Identifier,
  Observation,
  Patient,
  ObservationReferenceRange,
  Reference,
  Specimen,
  Practitioner,
  ServiceRequest,
  Annotation,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { LOINC_URL, CPT_URL } from "../../../util/constants";
import { getPatientReference } from "./patient";
import { HL7_OBSERVATION_INTERPRETATION_SYSTEM, QUEST_LOCAL_RESULT_CODE_SYSTEM } from "./constant";
import { getQuestDataSourceExtension } from "./shared";
import { getSpecimenReference } from "./specimen";
import { getServiceRequestReference } from "./service-request";
import { getPractitionerReference } from "./practitioner";

type ObservationValue = Pick<Observation, "valueQuantity" | "valueString" | "valueCodeableConcept">;

export function getObservation(
  detail: ResponseDetail,
  {
    patient,
    practitioner,
    specimen,
    serviceRequest,
  }: {
    patient: Patient;
    practitioner: Practitioner;
    specimen?: Specimen | undefined;
    serviceRequest?: ServiceRequest | undefined;
  }
): Observation {
  const identifier = getObservationIdentifier(detail);
  const code = getObservationCode(detail);
  const category = getObservationCategory();
  const subject = getPatientReference(patient);
  const performer = practitioner ? [getPractitionerReference(practitioner)] : undefined;
  const effectiveDateTime = getEffectiveDateTime(detail);
  const basedOn = serviceRequest ? [getServiceRequestReference(serviceRequest)] : undefined;
  const specimenReference = specimen ? getSpecimenReference(specimen) : undefined;
  const interpretation = getObservationInterpretation(detail);
  const referenceRange = getObservationReferenceRange(detail);
  const note = getObservationNote(detail);
  const { valueQuantity, valueString } = getObservationValue(detail);
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "Observation",
    id: uuidv7(),
    status: "final",
    subject,
    category,
    ...(performer ? { performer } : {}),
    ...(effectiveDateTime ? { effectiveDateTime } : {}),
    ...(valueQuantity ? { valueQuantity } : {}),
    ...(valueString ? { valueString } : {}),
    ...(referenceRange ? { referenceRange } : {}),
    ...(interpretation ? { interpretation } : {}),
    ...(identifier ? { identifier } : {}),
    ...(basedOn ? { basedOn } : {}),
    ...(code ? { code } : {}),
    ...(note ? { note } : {}),
    ...(specimenReference ? { specimen: specimenReference } : {}),
    extension,
  };
}

export function getObservationReference(observation: Observation): Reference<Observation> {
  return {
    reference: `Observation/${observation.id}`,
  };
}

function getEffectiveDateTime(detail: ResponseDetail): string | undefined {
  if (!detail.dateOfService) return undefined;
  return detail.dateOfService.toISOString();
}

function getObservationCategory(): CodeableConcept[] {
  return [
    {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "laboratory",
        },
      ],
    },
  ];
}

function getObservationIdentifier(detail: ResponseDetail): Identifier[] {
  return [
    {
      system: QUEST_LOCAL_RESULT_CODE_SYSTEM,
      value: detail.localResultCode,
    },
  ];
}

function getObservationCode(detail: ResponseDetail): CodeableConcept {
  const text = detail.resultName;
  const coding: Coding[] = [];
  if (detail.loincCode) {
    coding.push({
      system: LOINC_URL,
      code: detail.loincCode,
    });
  }
  if (detail.localResultCode) {
    coding.push({
      system: QUEST_LOCAL_RESULT_CODE_SYSTEM,
      code: detail.localResultCode,
      ...(text ? { display: text } : {}),
    });
  }
  if (detail.cptCode) {
    coding.push({
      system: CPT_URL,
      code: detail.cptCode,
    });
  }

  return {
    ...(text ? { text } : {}),
    coding,
  };
}

function getObservationReferenceRange(
  detail: ResponseDetail
): ObservationReferenceRange[] | undefined {
  const low = parseFloat(detail.referenceRangeLow ?? "");
  const high = parseFloat(detail.referenceRangeHigh ?? "");
  const text = detail.referenceRangeAlpha;
  if (!Number.isFinite(low) && !Number.isFinite(high)) return undefined;

  return [
    {
      ...(text ? { text } : {}),
      ...(low ? { low: { value: low } } : {}),
      ...(high ? { high: { value: high } } : {}),
    },
  ];
}

function getObservationValue(detail: ResponseDetail): ObservationValue {
  const values: ObservationValue = {};
  if (detail.resultValue != null) {
    if (detail.resultUnits != null) {
      values.valueQuantity = {
        value: parseFloat(detail.resultValue),
        unit: detail.resultUnits,
      };
    } else {
      values.valueString = detail.resultValue;
    }
  }
  return values;
}

function getObservationInterpretation(detail: ResponseDetail): CodeableConcept[] | undefined {
  if (!detail.abnormalFlag) return undefined;

  const code = detail.abnormalFlag;
  const display = {
    A: "Abnormal",
    N: "Normal",
    H: "High",
    L: "Low",
  }[code];

  return [
    {
      coding: [
        {
          system: HL7_OBSERVATION_INTERPRETATION_SYSTEM,
          code,
          ...(display ? { display } : {}),
        },
      ],
    },
  ];
}

function getObservationNote(detail: ResponseDetail): Annotation[] | undefined {
  if (!detail.resultComments) return undefined;
  return [
    {
      text: detail.resultComments,
    },
  ];
}
