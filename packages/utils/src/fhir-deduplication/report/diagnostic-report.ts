import { DiagnosticReport, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import {
  category0Columns,
  category1Columns,
  codeColumns,
  effectiveDateTimeColumns,
  effectivePeriodColumns,
  getCategories,
  getCode,
  getEffectiveDateTime,
  getEffectivePeriod,
} from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/observation.html if you want to add them
const columns = [
  "id",
  "date",
  "links",
  "status",
  "status_s",
  "basedOnRef0",
  "basedOnRef0_s",
  "basedOnRef1",
  "basedOnRef1_s",
  ...category0Columns,
  ...category1Columns,
  ...codeColumns,
  "subjRef",
  "subjRef_s",
  "encounterRef",
  "encounterRef_s",
  ...effectiveDateTimeColumns,
  ...effectivePeriodColumns,
  "issued",
  "issued_s",
  "perfRef0",
  "perfRef0_s",
  "perfRef1",
  "perfRef1_s",
  "perfRef2",
  "perfRef2_s",
  "perfRef3",
  "perfRef3_s",
  "resCount",
  "resCount_s",
  "res0",
  "res0_s",
  "res1",
  "res1_s",
  "res2",
  "res2_s",
  "res3",
  "res3_s",
  "presFormCount",
  "presFormCount_s",
  "presForm0_cnttType",
  "presForm0_cnttType_s",
  "presForm0_data",
  "presForm0_data_s",
  "presForm0_size",
  "presForm0_size_s",
  "presForm0_url",
  "presForm0_url_s",
  "presForm0_title",
  "presForm0_title_s",
  "presForm0_lang",
  "presForm0_lang_s",
  "presForm0_creat",
  "presForm0_creat_s",
  "presForm1_cnttType",
  "presForm1_cnttType_s",
  "presForm1_data",
  "presForm1_data_s",
  "presForm1_size",
  "presForm1_size_s",
  "presForm1_url",
  "presForm1_url_s",
  "presForm1_title",
  "presForm1_title_s",
  "presForm1_lang",
  "presForm1_lang_s",
  "presForm1_creat",
  "presForm1_creat_s",
  "presForm2_cnttType",
  "presForm2_cnttType_s",
  "presForm2_data",
  "presForm2_data_s",
  "presForm2_size",
  "presForm2_size_s",
  "presForm2_url",
  "presForm2_url_s",
  "presForm2_title",
  "presForm2_title_s",
  "presForm2_lang",
  "presForm2_lang_s",
  "presForm2_creat",
  "presForm2_creat_s",
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processDiagnosticReport(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: DiagnosticReport[] = (originalDic.DiagnosticReport ?? []).flatMap(
    r => (r as DiagnosticReport) ?? []
  );
  const dedup: DiagnosticReport[] = (dedupDic.DiagnosticReport ?? []).flatMap(
    r => (r as DiagnosticReport) ?? []
  );

  const originalFileName = patientDirName + `/DiagnosticReport-original.csv`;
  const dedupFileName = patientDirName + `/DiagnosticReport-dedup.csv`;

  const header = columns.join(csvSeparator);
  fs.writeFileSync(originalFileName, header + "\n");
  fs.writeFileSync(dedupFileName, header + "\n");

  const originalCsv = original
    .sort(sort)
    .map(m => toCsv(m, dedup))
    .join("\n");
  const dedupCsv = dedup
    .sort(sort)
    .map(m => toCsv(m, original))
    .join("\n");

  fs.writeFileSync(originalFileName, originalCsv, { flag: "a+" });
  fs.writeFileSync(dedupFileName, dedupCsv, { flag: "a+" });
}

function sort(a: DiagnosticReport, b: DiagnosticReport): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: DiagnosticReport, others: DiagnosticReport[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const basedOnRef0 = resource.basedOn?.[0]?.reference ?? "";
  const basedOnRef1 = resource.basedOn?.[1]?.reference ?? "";
  const subjRef = resource.subject?.reference ?? "";
  const encounterRef = resource.encounter?.reference ?? "";
  const issued = resource.issued ? new Date(resource.issued).toISOString() : "";
  const perfRef0 = resource.performer?.[0]?.reference ?? "";
  const perfRef1 = resource.performer?.[1]?.reference ?? "";
  const perfRef2 = resource.performer?.[2]?.reference ?? "";
  const perfRef3 = resource.performer?.[3]?.reference ?? "";
  const resCount = resource.result?.length ?? 0;
  const res0 = resource.result?.[0]?.reference ?? "";
  const res1 = resource.result?.[1]?.reference ?? "";
  const res2 = resource.result?.[2]?.reference ?? "";
  const res3 = resource.result?.[3]?.reference ?? "";
  const presFormCount = resource.presentedForm?.length ?? 0;
  const presForm0 = resource.presentedForm?.[0];
  const presForm0_cnttType = presForm0?.contentType ?? "";
  const presForm0_data = presForm0?.data?.length ?? "";
  const presForm0_size = presForm0?.size ?? "";
  const presForm0_url = presForm0?.url ?? "";
  const presForm0_title = presForm0?.title ?? "";
  const presForm0_lang = presForm0?.language ?? "";
  const presForm0_creat = presForm0?.creation ?? "";
  const presForm1 = resource.presentedForm?.[1];
  const presForm1_cnttType = presForm1?.contentType ?? "";
  const presForm1_data = presForm1?.data?.length ?? "";
  const presForm1_size = presForm1?.size ?? "";
  const presForm1_url = presForm1?.url ?? "";
  const presForm1_title = presForm1?.title ?? "";
  const presForm1_lang = presForm1?.language ?? "";
  const presForm1_creat = presForm1?.creation ?? "";
  const presForm2 = resource.presentedForm?.[2];
  const presForm2_cnttType = presForm2?.contentType ?? "";
  const presForm2_data = presForm2?.data?.length ?? "";
  const presForm2_size = presForm2?.size ?? "";
  const presForm2_url = presForm2?.url ?? "";
  const presForm2_title = presForm2?.title ?? "";
  const presForm2_lang = presForm2?.language ?? "";
  const presForm2_creat = presForm2?.creation ?? "";

  const status_s = firstSibling?.status ?? "";
  const basedOnRef0_s = firstSibling?.basedOn?.[0]?.reference ?? "";
  const basedOnRef1_s = firstSibling?.basedOn?.[1]?.reference ?? "";
  const subjRef_s = firstSibling?.subject?.reference ?? "";
  const encounterRef_s = firstSibling?.encounter?.reference ?? "";
  const issued_s = firstSibling?.issued ? new Date(firstSibling.issued).toISOString() : "";
  const perfRef0_s = firstSibling?.performer?.[0]?.reference ?? "";
  const perfRef1_s = firstSibling?.performer?.[1]?.reference ?? "";
  const perfRef2_s = firstSibling?.performer?.[2]?.reference ?? "";
  const perfRef3_s = firstSibling?.performer?.[3]?.reference ?? "";
  const resCount_s = firstSibling?.result?.length ?? 0;
  const res0_s = firstSibling?.result?.[0]?.reference ?? "";
  const res1_s = firstSibling?.result?.[1]?.reference ?? "";
  const res2_s = firstSibling?.result?.[2]?.reference ?? "";
  const res3_s = firstSibling?.result?.[3]?.reference ?? "";
  const presFormCount_s = firstSibling?.presentedForm?.length ?? 0;
  const presForm0_s = firstSibling?.presentedForm?.[0];
  const presForm0_cnttType_s = presForm0_s?.contentType ?? "";
  const presForm0_data_s = presForm0_s?.data?.length ?? "";
  const presForm0_size_s = presForm0_s?.size ?? "";
  const presForm0_url_s = presForm0_s?.url ?? "";
  const presForm0_title_s = presForm0_s?.title ?? "";
  const presForm0_lang_s = presForm0_s?.language ?? "";
  const presForm0_creat_s = presForm0_s?.creation ?? "";
  const presForm1_s = firstSibling?.presentedForm?.[1];
  const presForm1_cnttType_s = presForm1_s?.contentType ?? "";
  const presForm1_data_s = presForm1_s?.data?.length ?? "";
  const presForm1_size_s = presForm1_s?.size ?? "";
  const presForm1_url_s = presForm1_s?.url ?? "";
  const presForm1_title_s = presForm1_s?.title ?? "";
  const presForm1_lang_s = presForm1_s?.language ?? "";
  const presForm1_creat_s = presForm1_s?.creation ?? "";
  const presForm2_s = firstSibling?.presentedForm?.[2];
  const presForm2_cnttType_s = presForm2_s?.contentType ?? "";
  const presForm2_data_s = presForm2_s?.data?.length ?? "";
  const presForm2_size_s = presForm2_s?.size ?? "";
  const presForm2_url_s = presForm2_s?.url ?? "";
  const presForm2_title_s = presForm2_s?.title ?? "";
  const presForm2_lang_s = presForm2_s?.language ?? "";
  const presForm2_creat_s = presForm2_s?.creation ?? "";

  const category = getCategories(resource, firstSibling);
  const effectiveDateTime = getEffectiveDateTime(resource, firstSibling);
  const effectivePeriod = getEffectivePeriod(resource, firstSibling);
  const code = getCode(resource, firstSibling);

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    date,
    links,
    status,
    status_s,
    basedOnRef0,
    basedOnRef0_s,
    basedOnRef1,
    basedOnRef1_s,
    ...category,
    ...code,
    subjRef,
    subjRef_s,
    encounterRef,
    encounterRef_s,
    ...effectiveDateTime,
    ...effectivePeriod,
    issued,
    issued_s,
    perfRef0,
    perfRef0_s,
    perfRef1,
    perfRef1_s,
    perfRef2,
    perfRef2_s,
    perfRef3,
    perfRef3_s,
    resCount,
    resCount_s,
    res0,
    res0_s,
    res1,
    res1_s,
    res2,
    res2_s,
    res3,
    res3_s,
    presFormCount,
    presFormCount_s,
    presForm0_cnttType,
    presForm0_cnttType_s,
    presForm0_data,
    presForm0_data_s,
    presForm0_size,
    presForm0_size_s,
    presForm0_url,
    presForm0_url_s,
    presForm0_title,
    presForm0_title_s,
    presForm0_lang,
    presForm0_lang_s,
    presForm0_creat,
    presForm0_creat_s,
    presForm1_cnttType,
    presForm1_cnttType_s,
    presForm1_data,
    presForm1_data_s,
    presForm1_size,
    presForm1_size_s,
    presForm1_url,
    presForm1_url_s,
    presForm1_title,
    presForm1_title_s,
    presForm1_lang,
    presForm1_lang_s,
    presForm1_creat,
    presForm1_creat_s,
    presForm2_cnttType,
    presForm2_cnttType_s,
    presForm2_data,
    presForm2_data_s,
    presForm2_size,
    presForm2_size_s,
    presForm2_url,
    presForm2_url_s,
    presForm2_title,
    presForm2_title_s,
    presForm2_lang,
    presForm2_lang_s,
    presForm2_creat,
    presForm2_creat_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
