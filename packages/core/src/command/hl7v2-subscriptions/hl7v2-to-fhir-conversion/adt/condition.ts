import { Hl7Message } from "@medplum/core";
import { CodeableConcept, Coding, Condition, EncounterDiagnosis } from "@medplum/fhirtypes";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import {
  buildConditionReference,
  buildPatientReference,
} from "../../../../external/fhir/shared/references";
import { getConditionCoding } from "./utils";

type ConditionWithId = Condition & {
  id: string;
};

type AdmitReason = {
  reasonCode: CodeableConcept[];
  condition: Condition;
  diagnosis: EncounterDiagnosis[];
};

type ConditionWithCode = Partial<Condition> & {
  code: CodeableConcept;
};

export function getAdmitReason(adt: Hl7Message, patientId: string): AdmitReason | undefined {
  const pv2Segment = adt.getSegment("PV2");
  if (!pv2Segment || pv2Segment.fields.length < 1) return undefined;

  const mainCoding = getConditionCoding(pv2Segment, 0);
  const secondaryCoding = getConditionCoding(pv2Segment, 1);

  const coding = [mainCoding, secondaryCoding].flatMap(c => c ?? []);
  if (coding.length < 1) return undefined;

  // TODO 2883: See if we can parse (or infer) onsetDateTime and other fields (so far looks like a no)
  const condition = buildCondition({ code: { coding } }, patientId);
  const diagnosisReference = buildConditionReference({ resource: condition });

  return {
    reasonCode: [{ coding }],
    condition,
    diagnosis: [diagnosisReference],
  };
}

export function buildConditionCoding({
  code,
  display,
  system,
}: {
  code?: string | undefined;
  display?: string | undefined;
  system?: string | undefined;
}): Coding | undefined {
  if (!code && !display) return undefined;

  const systemUrl = system ?? inferConditionSystem(code);
  return {
    ...(code ? { code } : undefined),
    ...(display ? { display } : undefined),
    ...(systemUrl ? { system: systemUrl } : undefined),
  };
}

export function buildCondition(params: ConditionWithCode, patientId: string): ConditionWithId {
  const { id, code, ...rest } = params;

  return {
    id: id ?? createUuidFromText(JSON.stringify(code)),
    resourceType: "Condition",
    code,
    subject: buildPatientReference(patientId),
    ...rest,
  };
}

function inferConditionSystem(code: string | undefined): string | undefined {
  if (!code) return undefined;

  // TODO 2883: See if we can infer the system being ICD-10 / LOINC / SNOMED
  return undefined;
}
