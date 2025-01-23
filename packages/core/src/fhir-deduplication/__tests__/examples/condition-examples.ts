import { Coding } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";

export const snomedCodeMd: Coding = { system: "http://snomed.info/sct", code: "422338006" };
export const icd10CodeMd: Coding = {
  system: "http://hl7.org/fhir/sid/icd-10-cm",
  code: "H35.30",
  display: "Macular degeneration",
};
export const otherCodeSystemMd: Coding = {
  system: "http://terminology.hl7.org/CodeSystem-IMO.html",
  code: "86946",
  display: "Macular degeneration",
};

export const snomedCodeAo: Coding = { system: "http://snomed.info/sct", code: "87224000" };
export const icd10CodeAo: Coding = {
  system: "http://hl7.org/fhir/sid/icd-10-cm",
  code: "H34.00",
  display: "Transient arterial occlusion of retina",
};

export const dateTime = {
  start: "2012-01-01T10:00:00.000Z",
};

export const dateTime2 = {
  start: "2014-02-01T10:00:00.000Z",
};

export function makePeriod(start?: string | undefined, end?: string | undefined) {
  return {
    start: start ? buildDayjs(start).toISOString() : dateTime.start,
    end: end ? buildDayjs(end).toISOString() : dateTime2.start,
  };
}
