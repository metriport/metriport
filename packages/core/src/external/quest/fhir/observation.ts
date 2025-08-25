import {
  CodeableConcept,
  Coding,
  Identifier,
  Observation,
  Patient,
  ObservationReferenceRange,
} from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { ResponseDetail } from "../schema/response";
import { getPatientReference } from "./patient";
import { getQuestDataSourceExtension } from "./shared";
import { LOINC_URL, CPT_URL } from "@metriport/shared/medical";
import { HL7_OBSERVATION_INTERPRETATION_SYSTEM, QUEST_LOCAL_RESULT_CODE_SYSTEM } from "./constant";

type ObservationValue = Pick<Observation, "valueQuantity" | "valueString" | "valueCodeableConcept">;

export function getObservation(
  detail: ResponseDetail,
  { patient }: { patient: Patient }
): Observation {
  const identifier = getObservationIdentifier(detail);
  const code = getObservationCode(detail);
  const subject = getPatientReference(patient);
  const interpretation = getObservationInterpretation(detail);
  const referenceRange = getObservationReferenceRange(detail);
  const { valueQuantity, valueString } = getObservationValue(detail);
  const extension = [getQuestDataSourceExtension()];

  return {
    resourceType: "Observation",
    id: uuidv7(),
    status: "final",
    subject,
    ...(valueQuantity ? { valueQuantity } : {}),
    ...(valueString ? { valueString } : {}),
    ...(referenceRange ? { referenceRange } : {}),
    ...(interpretation ? { interpretation } : {}),
    ...(identifier ? { identifier } : {}),
    ...(code ? { code } : {}),
    extension,
  };
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
      ...(Number.isFinite(low) ? { low: { value: low } } : {}),
      ...(Number.isFinite(high) ? { high: { value: high } } : {}),
    },
  ];
}

function getObservationValue(detail: ResponseDetail): ObservationValue {
  const observationValue: ObservationValue = {};
  if (detail.resultValue != null) {
    const value = parseFloat(detail.resultValue);
    if (Number.isFinite(value) && detail.resultUnits) {
      observationValue.valueQuantity = {
        value,
        unit: detail.resultUnits,
      };
    } else {
      observationValue.valueString = detail.resultValue;
    }
  }
  return observationValue;
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
