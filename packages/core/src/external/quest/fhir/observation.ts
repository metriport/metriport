import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import {
  CodeableConcept,
  Coding,
  Identifier,
  Observation,
  Patient,
  ObservationReferenceRange,
  Reference,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { LOINC_URL, CPT_URL } from "../../../util/constants";
import { getPatientReference } from "./patient";
import { HL7_OBSERVATION_INTERPRETATION_SYSTEM, QUEST_LOCAL_RESULT_CODE_SYSTEM } from "./constant";
import { getQuestDataSourceExtension } from "./shared";

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

export function getObservationReference(observation: Observation): Reference<Observation> {
  return {
    reference: `Observation/${observation.id}`,
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
      ...(low ? { low: { value: low } } : {}),
      ...(high ? { high: { value: high } } : {}),
    },
  ];
}

function getObservationValue(detail: ResponseDetail): ObservationValue {
  const values: ObservationValue = {};
  if (detail.resultValue != null) {
    if (detail.resultUnits) {
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
