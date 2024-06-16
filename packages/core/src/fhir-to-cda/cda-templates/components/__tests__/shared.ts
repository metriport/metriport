import { faker } from "@faker-js/faker";
import { Bundle } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import fs from "fs";
import { formatDateToCdaTimestamp, formatDateToHumanReadableFormat } from "../../commons";

export function makeBaseDomain() {
  return {
    id: faker.string.uuid(),
  };
}

export function makeSubjectReference() {
  return {
    subject: { reference: `Patient/${faker.string.uuid()}` },
  };
}

export function createEmptyBundle(): Bundle {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: [],
  };
}

export function getPastDateInDifferentFormats(subtractYears?: number): {
  dateIso: string;
  dateCda: string;
  dateHumanReadable: string;
} {
  const dateMinusTwoYears = dayjs().subtract(subtractYears ?? 1, "year");
  const dateIso = dateMinusTwoYears.toISOString();
  const dateCda = formatDateToCdaTimestamp(dateIso);
  const dateHumanReadable = formatDateToHumanReadableFormat(dateIso);
  if (!dateCda || !dateHumanReadable) throw new Error("Past dates failed to initialize");

  return {
    dateIso,
    dateCda,
    dateHumanReadable,
  };
}

export function getPastDate(subtractYears?: number): string {
  const dateMinusTwoYears = dayjs().subtract(subtractYears ?? 1, "year");
  const dateFhir = dateMinusTwoYears.toISOString();
  return dateFhir;
}

export function getXmlContentFromFile(filePath: string): string {
  const xmlTemplate = fs.readFileSync(filePath, "utf8");
  const lines = xmlTemplate.split("\n");
  let xmlContent = "";
  lines.forEach(line => {
    xmlContent += line.trim();
  });
  return xmlContent;
}
