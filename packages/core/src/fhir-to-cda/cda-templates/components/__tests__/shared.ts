import { Bundle } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { formatDateToCdaTimestamp, formatDateToHumanReadableFormat } from "../../commons";

export function createEmptyBundle(): Bundle {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: [],
  };
}

export function getPastDateInDifferentFormats(subtractYears?: number): {
  dateFhir: string;
  dateXml: string;
  dateHumanReadable: string;
} {
  const dateMinusTwoYears = dayjs().subtract(subtractYears ?? 1, "year");
  const dateFhir = dateMinusTwoYears.toISOString();
  const dateXml = formatDateToCdaTimestamp(dateFhir);
  const dateHumanReadable = formatDateToHumanReadableFormat(dateFhir);
  if (!dateXml || !dateHumanReadable) throw new Error("Past dates failed to initialize");

  return {
    dateFhir,
    dateXml,
    dateHumanReadable,
  };
}

export function getPastDate(subtractYears?: number): string {
  const dateMinusTwoYears = dayjs().subtract(subtractYears ?? 1, "year");
  const dateFhir = dateMinusTwoYears.toISOString();
  return dateFhir;
}
