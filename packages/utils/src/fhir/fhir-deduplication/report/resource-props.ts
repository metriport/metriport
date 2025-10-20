import {
  Annotation,
  CodeableConcept,
  ObservationReferenceRange,
  Period,
  Reference,
} from "@medplum/fhirtypes";

export const codeColumns = [
  "code_code0",
  "code_code0_s",
  "code_disp0",
  "code_disp0_s",
  "code_code1",
  "code_code1_s",
  "code_disp1",
  "code_disp1_s",
  "code_code2",
  "code_code2_s",
  "code_disp2",
  "code_disp2_s",
  "code_text",
  "code_text_s",
] as const;
export type CodeColumns = (typeof codeColumns)[number];
export function getCode(
  resource: { code?: CodeableConcept },
  sibling: { code?: CodeableConcept } | undefined
): Record<CodeColumns, string> {
  const res = resource.code;
  const code_code0 = res?.coding?.[0]?.code ?? "";
  const code_disp0 = res?.coding?.[0]?.display ?? "";
  const code_code1 = res?.coding?.[1]?.code ?? "";
  const code_disp1 = res?.coding?.[1]?.display ?? "";
  const code_code2 = res?.coding?.[2]?.code ?? "";
  const code_disp2 = res?.coding?.[2]?.display ?? "";
  const code_text = res?.text ?? "";
  const sib = sibling?.code;
  const code_code0_s = sib?.coding?.[0]?.code ?? "";
  const code_disp0_s = sib?.coding?.[0]?.display ?? "";
  const code_code1_s = sib?.coding?.[1]?.code ?? "";
  const code_disp1_s = sib?.coding?.[1]?.display ?? "";
  const code_code2_s = sib?.coding?.[2]?.code ?? "";
  const code_disp2_s = sib?.coding?.[2]?.display ?? "";
  const code_text_s = sib?.text ?? "";
  return {
    code_code0,
    code_code0_s,
    code_disp0,
    code_disp0_s,
    code_code1,
    code_code1_s,
    code_disp1,
    code_disp1_s,
    code_code2,
    code_code2_s,
    code_disp2,
    code_disp2_s,
    code_text,
    code_text_s,
  };
}

export const category0Columns = [
  "cat0_code0",
  "cat0_code0_s",
  "cat0_disp0",
  "cat0_disp0_s",
  "cat0_code1",
  "cat0_code1_s",
  "cat0_disp1",
  "cat0_disp1_s",
  "cat0_text",
  "cat0_text_s",
] as const;
export const category1Columns = [
  "cat1_code0",
  "cat1_code0_s",
  "cat1_disp0",
  "cat1_disp0_s",
  "cat1_code1",
  "cat1_code1_s",
  "cat1_disp1",
  "cat1_disp1_s",
  "cat1_text",
  "cat1_text_s",
] as const;
export type Category0Columns = (typeof category0Columns)[number];
export type Category1Columns = (typeof category1Columns)[number];
export function getCategory(
  resource: { category?: CodeableConcept },
  sibling: { category?: CodeableConcept } | undefined
): Record<Category0Columns, string> {
  const res = Array.isArray(resource.category) ? resource.category[0] : resource.category;
  const cat0_code0 = res?.coding?.[0]?.code ?? "";
  const cat0_disp0 = res?.coding?.[0]?.display ?? "";
  const cat0_code1 = res?.coding?.[1]?.code ?? "";
  const cat0_disp1 = res?.coding?.[1]?.display ?? "";
  const cat0_text = res?.text ?? "";
  const sib = Array.isArray(sibling?.category) ? sibling?.category[0] : undefined;
  const cat0_code0_s = sib?.coding?.[0]?.code ?? "";
  const cat0_disp0_s = sib?.coding?.[0]?.display ?? "";
  const cat0_code1_s = sib?.coding?.[1]?.code ?? "";
  const cat0_disp1_s = sib?.coding?.[1]?.display ?? "";
  const cat0_text_s = sib?.text ?? "";
  return {
    cat0_code0,
    cat0_code0_s,
    cat0_disp0,
    cat0_disp0_s,
    cat0_code1,
    cat0_code1_s,
    cat0_disp1,
    cat0_disp1_s,
    cat0_text,
    cat0_text_s,
  };
}
export function getCategories(
  resource: { category?: CodeableConcept[] },
  sibling: { category?: CodeableConcept[] } | undefined
): Record<Category0Columns, string> & Record<Category1Columns, string> {
  const category0 = getCategory(
    { category: resource.category?.[0] },
    { category: sibling?.category?.[0] }
  );
  const res = Array.isArray(resource.category) ? resource.category[1] : undefined;
  const cat1_code0 = res?.coding?.[0]?.code ?? "";
  const cat1_disp0 = res?.coding?.[0]?.display ?? "";
  const cat1_code1 = res?.coding?.[1]?.code ?? "";
  const cat1_disp1 = res?.coding?.[1]?.display ?? "";
  const cat1_text = res?.text ?? "";
  const sib = Array.isArray(sibling?.category) ? sibling?.category[1] : undefined;
  const cat1_code0_s = sib?.coding?.[0]?.code ?? "";
  const cat1_disp0_s = sib?.coding?.[0]?.display ?? "";
  const cat1_code1_s = sib?.coding?.[1]?.code ?? "";
  const cat1_disp1_s = sib?.coding?.[1]?.display ?? "";
  const cat1_text_s = sib?.text ?? "";
  return {
    ...category0,
    cat1_code0,
    cat1_code0_s,
    cat1_disp0,
    cat1_disp0_s,
    cat1_code1,
    cat1_code1_s,
    cat1_disp1,
    cat1_disp1_s,
    cat1_text,
    cat1_text_s,
  };
}

export const effectiveDateTimeColumns = ["eDateTime", "eDateTime_s"] as const;
export type EffectiveDateTimeColumns = (typeof effectiveDateTimeColumns)[number];
export function getEffectiveDateTime(
  resource: { effectiveDateTime?: string },
  sibling: { effectiveDateTime?: string } | undefined
): Record<EffectiveDateTimeColumns, string> {
  const eDateTime = resource.effectiveDateTime ?? "";
  const eDateTime_s = sibling?.effectiveDateTime ?? "";
  return { eDateTime, eDateTime_s };
}

export const effectivePeriodColumns = [
  "ePeriod_start",
  "ePeriod_start_s",
  "ePeriod_end",
  "ePeriod_end_s",
] as const;
export type EffectivePeriodColumns = (typeof effectivePeriodColumns)[number];
export function getEffectivePeriod(
  resource: { effectivePeriod?: Period },
  sibling: { effectivePeriod?: Period } | undefined
): Record<EffectivePeriodColumns, string> {
  const ePeriod_start = resource.effectivePeriod?.start ?? "";
  const ePeriod_end = resource.effectivePeriod?.end ?? "";
  const ePeriod_start_s = sibling?.effectivePeriod?.start ?? "";
  const ePeriod_end_s = sibling?.effectivePeriod?.end ?? "";
  return { ePeriod_start, ePeriod_end, ePeriod_start_s, ePeriod_end_s };
}

export const valueCodeableConceptColumns = [
  "valCdblCncpt_code0",
  "valCdblCncpt_code0_s",
  "valCdblCncpt_disp0",
  "valCdblCncpt_disp0_s",
  "valCdblCncpt_code1",
  "valCdblCncpt_code1_s",
  "valCdblCncpt_disp1",
  "valCdblCncpt_disp1_s",
  "valCdblCncpt_text",
  "valCdblCncpt_text_s",
] as const;
export type ValueCodeableConceptColumns = (typeof valueCodeableConceptColumns)[number];
export function getValueCodeableConcept(
  resource: { valueCodeableConcept?: CodeableConcept },
  sibling: { valueCodeableConcept?: CodeableConcept } | undefined
): Record<ValueCodeableConceptColumns, string> {
  const res = resource.valueCodeableConcept;
  const valCdblCncpt_code0 = res?.coding?.[0]?.code ?? "";
  const valCdblCncpt_disp0 = res?.coding?.[0]?.display ?? "";
  const valCdblCncpt_code1 = res?.coding?.[1]?.code ?? "";
  const valCdblCncpt_disp1 = res?.coding?.[1]?.display ?? "";
  const valCdblCncpt_text = res?.text ?? "";
  const sib = sibling?.valueCodeableConcept;
  const valCdblCncpt_code0_s = sib?.coding?.[0]?.code ?? "";
  const valCdblCncpt_disp0_s = sib?.coding?.[0]?.display ?? "";
  const valCdblCncpt_code1_s = sib?.coding?.[1]?.code ?? "";
  const valCdblCncpt_disp1_s = sib?.coding?.[1]?.display ?? "";
  const valCdblCncpt_text_s = sib?.text ?? "";
  return {
    valCdblCncpt_code0,
    valCdblCncpt_code0_s,
    valCdblCncpt_disp0,
    valCdblCncpt_disp0_s,
    valCdblCncpt_code1,
    valCdblCncpt_code1_s,
    valCdblCncpt_disp1,
    valCdblCncpt_disp1_s,
    valCdblCncpt_text,
    valCdblCncpt_text_s,
  };
}

export const interpretationColumns = [
  "intrpn_code0",
  "intrpn_code0_s",
  "intrpn_disp0",
  "intrpn_disp0_s",
  "intrpn_code1",
  "intrpn_code1_s",
  "intrpn_disp1",
  "intrpn_disp1_s",
  "intrpn_text",
  "intrpn_text_s",
] as const;
export type InterpretationColumns = (typeof interpretationColumns)[number];
export function getInterpretation(
  resource: { valueCodeableConcept?: CodeableConcept },
  sibling: { valueCodeableConcept?: CodeableConcept } | undefined
): Record<InterpretationColumns, string> {
  const interpretation = resource.valueCodeableConcept;
  const intrpn_code0 = interpretation?.coding?.[0]?.code ?? "";
  const intrpn_disp0 = interpretation?.coding?.[0]?.display ?? "";
  const intrpn_code1 = interpretation?.coding?.[1]?.code ?? "";
  const intrpn_disp1 = interpretation?.coding?.[1]?.display ?? "";
  const intrpn_text = interpretation?.text ?? "";
  const interpretation_s = sibling?.valueCodeableConcept;
  const intrpn_code0_s = interpretation_s?.coding?.[0]?.code ?? "";
  const intrpn_disp0_s = interpretation_s?.coding?.[0]?.display ?? "";
  const intrpn_code1_s = interpretation_s?.coding?.[1]?.code ?? "";
  const intrpn_disp1_s = interpretation_s?.coding?.[1]?.display ?? "";
  const intrpn_text_s = interpretation_s?.text ?? "";
  return {
    intrpn_code0,
    intrpn_code0_s,
    intrpn_disp0,
    intrpn_disp0_s,
    intrpn_code1,
    intrpn_code1_s,
    intrpn_disp1,
    intrpn_disp1_s,
    intrpn_text,
    intrpn_text_s,
  };
}

export const bodySiteColumns = [
  "bodySite_code0",
  "bodySite_code0_s",
  "bodySite_disp0",
  "bodySite_disp0_s",
  "bodySite_code1",
  "bodySite_code1_s",
  "bodySite_disp1",
  "bodySite_disp1_s",
  "bodySite_text",
  "bodySite_text_s",
] as const;
export type BodySiteColumns = (typeof bodySiteColumns)[number];
export function getBodySite(
  resource: { bodySite?: CodeableConcept },
  sibling: { bodySite?: CodeableConcept } | undefined
): Record<BodySiteColumns, string> {
  const bodySite = resource.bodySite;
  const bodySite_code0 = bodySite?.coding?.[0]?.code ?? "";
  const bodySite_disp0 = bodySite?.coding?.[0]?.display ?? "";
  const bodySite_code1 = bodySite?.coding?.[1]?.code ?? "";
  const bodySite_disp1 = bodySite?.coding?.[1]?.display ?? "";
  const bodySite_text = bodySite?.text ?? "";
  const bodySite_s = sibling?.bodySite;
  const bodySite_code0_s = bodySite_s?.coding?.[0]?.code ?? "";
  const bodySite_disp0_s = bodySite_s?.coding?.[0]?.display ?? "";
  const bodySite_code1_s = bodySite_s?.coding?.[1]?.code ?? "";
  const bodySite_disp1_s = bodySite_s?.coding?.[1]?.display ?? "";
  const bodySite_text_s = bodySite_s?.text ?? "";
  return {
    bodySite_code0,
    bodySite_code0_s,
    bodySite_disp0,
    bodySite_disp0_s,
    bodySite_code1,
    bodySite_code1_s,
    bodySite_disp1,
    bodySite_disp1_s,
    bodySite_text,
    bodySite_text_s,
  };
}

export const notesColumns = ["note0_txt", "note0_txt_s", "note1_txt", "note1_txt_s"] as const;
export type NotesColumns = (typeof notesColumns)[number];
export function getNotes(
  resource: { note?: Annotation[] },
  sibling: { note?: Annotation[] } | undefined
): Record<NotesColumns, string> {
  const note0_txt = resource.note?.[0]?.text ?? "";
  const note1_txt = resource.note?.[1]?.text ?? "";
  const note0_txt_s = sibling?.note?.[0]?.text ?? "";
  const note1_txt_s = sibling?.note?.[1]?.text ?? "";
  return {
    note0_txt,
    note0_txt_s,
    note1_txt,
    note1_txt_s,
  };
}

export const refRangeColumns = [
  "refRange_low_val",
  "refRange_low_val_s",
  "refRange_low_unit",
  "refRange_low_unit_s",
  "refRange_high_val",
  "refRange_high_val_s",
  "refRange_high_unit",
  "refRange_high_unit_s",
  "refRange_type_code0",
  "refRange_type_code0_s",
  "refRange_type_disp0",
  "refRange_type_disp0_s",
  "refRange_type_code1",
  "refRange_type_code1_s",
  "refRange_type_disp1",
  "refRange_type_disp1_s",
  "refRange_type_text",
  "refRange_type_text_s",
  "refRange_text",
  "refRange_text_s",
] as const;
export type RefRangeColumns = (typeof refRangeColumns)[number];
export function getRefRange(
  resource: { referenceRange?: ObservationReferenceRange[] },
  sibling: { referenceRange?: ObservationReferenceRange[] } | undefined
): Record<RefRangeColumns, string | number> {
  const res = resource.referenceRange?.[0];
  const refRange_low_val = res?.low?.value ?? "";
  const refRange_low_unit = res?.low?.unit ?? "";
  const refRange_high_val = res?.high?.value ?? "";
  const refRange_high_unit = res?.high?.unit ?? "";
  const refRange_type_code0 = res?.type?.coding?.[0]?.code ?? "";
  const refRange_type_disp0 = res?.type?.coding?.[0]?.display ?? "";
  const refRange_type_code1 = res?.type?.coding?.[1]?.code ?? "";
  const refRange_type_disp1 = res?.type?.coding?.[1]?.display ?? "";
  const refRange_type_text = res?.type?.text ?? "";
  const refRange_text = res?.text ?? "";
  const sib = sibling?.referenceRange?.[0];
  const refRange_low_val_s = sib?.low?.value ?? "";
  const refRange_low_unit_s = sib?.low?.unit ?? "";
  const refRange_high_val_s = sib?.high?.value ?? "";
  const refRange_high_unit_s = sib?.high?.unit ?? "";
  const refRange_type_code0_s = sib?.type?.coding?.[0]?.code ?? "";
  const refRange_type_disp0_s = sib?.type?.coding?.[0]?.display ?? "";
  const refRange_type_code1_s = sib?.type?.coding?.[1]?.code ?? "";
  const refRange_type_disp1_s = sib?.type?.coding?.[1]?.display ?? "";
  const refRange_type_text_s = sib?.type?.text ?? "";
  const refRange_text_s = sib?.text ?? "";
  return {
    refRange_low_val,
    refRange_low_val_s,
    refRange_low_unit,
    refRange_low_unit_s,
    refRange_high_val,
    refRange_high_val_s,
    refRange_high_unit,
    refRange_high_unit_s,
    refRange_type_code0,
    refRange_type_code0_s,
    refRange_type_disp0,
    refRange_type_disp0_s,
    refRange_type_code1,
    refRange_type_code1_s,
    refRange_type_disp1,
    refRange_type_disp1_s,
    refRange_type_text,
    refRange_type_text_s,
    refRange_text,
    refRange_text_s,
  };
}

export const reasonCodeColumns = [
  "reason0_code0",
  "reason0_code0_s",
  "reason0_disp0",
  "reason0_disp0_s",
  "reason0_code1",
  "reason0_code1_s",
  "reason0_disp1",
  "reason0_disp1_s",
  "reason0_text",
  "reason0_text_s",
  "reason1_code0",
  "reason1_code0_s",
  "reason1_disp0",
  "reason1_disp0_s",
  "reason1_code1",
  "reason1_code1_s",
  "reason1_disp1",
  "reason1_disp1_s",
  "reason1_text",
  "reason1_text_s",
] as const;
export type ReasonCodeColumns = (typeof reasonCodeColumns)[number];
export function getReasonCode(
  resource: { reasonCode?: CodeableConcept[] },
  sibling: { reasonCode?: CodeableConcept[] } | undefined
): Record<ReasonCodeColumns, string | number> {
  const res0 = resource.reasonCode?.[0];
  const reason0_code0 = res0?.coding?.[0]?.code ?? "";
  const reason0_disp0 = res0?.coding?.[0]?.display ?? "";
  const reason0_code1 = res0?.coding?.[1]?.code ?? "";
  const reason0_disp1 = res0?.coding?.[1]?.display ?? "";
  const reason0_text = res0?.text ?? "";
  const res1 = resource.reasonCode?.[1];
  const reason1_code0 = res1?.coding?.[0]?.code ?? "";
  const reason1_disp0 = res1?.coding?.[0]?.display ?? "";
  const reason1_code1 = res1?.coding?.[1]?.code ?? "";
  const reason1_disp1 = res1?.coding?.[1]?.display ?? "";
  const reason1_text = res1?.text ?? "";
  const sib0 = sibling?.reasonCode?.[0];
  const reason0_code0_s = sib0?.coding?.[0]?.code ?? "";
  const reason0_disp0_s = sib0?.coding?.[0]?.display ?? "";
  const reason0_code1_s = sib0?.coding?.[1]?.code ?? "";
  const reason0_disp1_s = sib0?.coding?.[1]?.display ?? "";
  const reason0_text_s = sib0?.text ?? "";
  const sib1 = sibling?.reasonCode?.[1];
  const reason1_code0_s = sib1?.coding?.[0]?.code ?? "";
  const reason1_disp0_s = sib1?.coding?.[0]?.display ?? "";
  const reason1_code1_s = sib1?.coding?.[1]?.code ?? "";
  const reason1_disp1_s = sib1?.coding?.[1]?.display ?? "";
  const reason1_text_s = sib1?.text ?? "";
  return {
    reason0_code0,
    reason0_code0_s,
    reason0_disp0,
    reason0_disp0_s,
    reason0_code1,
    reason0_code1_s,
    reason0_disp1,
    reason0_disp1_s,
    reason0_text,
    reason0_text_s,
    reason1_code0,
    reason1_code0_s,
    reason1_disp0,
    reason1_disp0_s,
    reason1_code1,
    reason1_code1_s,
    reason1_disp1,
    reason1_disp1_s,
    reason1_text,
    reason1_text_s,
  };
}

export const reasonReferenceColumns = [
  "reasonRef0",
  "reasonRef0_s",
  "reasonRef1",
  "reasonRef1_s",
] as const;
export type ReasonReferenceColumns = (typeof reasonReferenceColumns)[number];
export function getReasonReference(
  resource: { reasonReference?: Reference[] },
  sibling: { reasonReference?: Reference[] } | undefined
): Record<ReasonReferenceColumns, string | number> {
  const reasonRef0 = resource.reasonReference?.[0]?.reference ?? "";
  const reasonRef1 = resource.reasonReference?.[1]?.reference ?? "";
  const reasonRef0_s = sibling?.reasonReference?.[0]?.reference ?? "";
  const reasonRef1_s = sibling?.reasonReference?.[1]?.reference ?? "";
  return {
    reasonRef0,
    reasonRef0_s,
    reasonRef1,
    reasonRef1_s,
  };
}
