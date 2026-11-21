import { Bundle, DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildVariousNotesAndResults } from "../notes-and-results";
import { makeDiagnosticReport } from "./make-diagnostic-report";
import { makeObservation } from "./make-observation";
import { createEmptyBundle } from "./shared";

const labCategory = [
  {
    coding: [
      {
        system: "http://terminology.hl7.org/CodeSystem/v2-0074",
        code: "LAB",
        display: "Laboratory",
      },
    ],
  },
];

const effectiveDateTime = "2024-03-04T15:30:00.000Z";

let bundle: Bundle;

beforeEach(() => {
  bundle = createEmptyBundle();
});

function buildXml(): string {
  const sections = buildVariousNotesAndResults(bundle);
  return xmlBuilder.build(removeEmptyFields(sections));
}

function makeA1c(params: Partial<Observation> = {}): Observation {
  return makeObservation({
    status: "final",
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "4548-4",
          display: "Hemoglobin A1c/Hemoglobin.total in Blood",
        },
      ],
    },
    effectiveDateTime,
    valueQuantity: { value: 7.9, unit: "%", system: "http://unitsofmeasure.org", code: "%" },
    interpretation: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
            code: "H",
            display: "High",
          },
        ],
      },
    ],
    ...params,
  });
}

function makeCrp(params: Partial<Observation> = {}): Observation {
  return makeObservation({
    status: "final",
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "30522-7",
          display: "C reactive protein [Mass/volume] in Serum or Plasma by High sensitivity method",
        },
      ],
    },
    effectiveDateTime,
    valueQuantity: {
      value: 0.1,
      comparator: "<",
      unit: "mg/dL",
      system: "http://unitsofmeasure.org",
      code: "mg/dL",
    },
    ...params,
  });
}

function makeLabReport(observations: Observation[], params: Partial<DiagnosticReport> = {}) {
  return makeDiagnosticReport({
    status: "final",
    category: labCategory,
    code: {
      coding: observations.flatMap(obs => obs.code?.coding ?? []),
    },
    effectiveDateTime,
    result: observations.map(obs => ({ reference: `Observation/${obs.id}` })),
    ...params,
  });
}

describe("buildVariousNotesAndResults - results", () => {
  it("places a lab report coded only with analyte LOINCs in the Results section", () => {
    const a1c = makeA1c();
    bundle.entry?.push({ resource: a1c }, { resource: makeLabReport([a1c]) });

    const xml = buildXml();
    expect(xml).toContain("<title>RESULTS</title>");
    expect(xml).not.toContain("MISCELLANEOUS NOTES");
  });

  it("keeps a report with no lab category and no known code in Miscellaneous Notes", () => {
    const a1c = makeA1c();
    const report = makeLabReport([a1c]);
    delete report.category;
    bundle.entry?.push({ resource: a1c }, { resource: report });

    const xml = buildXml();
    expect(xml).toContain("<title>MISCELLANEOUS NOTES</title>");
  });

  it("writes a numeric result as PQ with its interpretation code", () => {
    const a1c = makeA1c();
    bundle.entry?.push({ resource: a1c }, { resource: makeLabReport([a1c]) });

    const xml = buildXml();
    expect(xml).toContain(`<value xsi:type="PQ"`);
    expect(xml).toContain(`value="7.9" unit="%"`);
    expect(xml).toContain(`<interpretationCode code="H" codeSystem="2.16.840.1.113883.5.83"`);
    expect(xml).toContain("<td>7.9 %</td>");
  });

  it("writes a result with a comparator as IVL_PQ and keeps the comparator in the table", () => {
    const crp = makeCrp();
    bundle.entry?.push({ resource: crp }, { resource: makeLabReport([crp]) });

    const xml = buildXml();
    expect(xml).toContain(`<value xsi:type="IVL_PQ"`);
    expect(xml).toContain(`<high value="0.1" unit="mg/dL" inclusive="false"></high>`);
    expect(xml).toContain("<td>&lt;0.1 mg/dL</td>");
  });

  it("uses the text value when there is no quantity", () => {
    const qns = makeA1c({ valueString: "QNS", interpretation: [] });
    delete qns.valueQuantity;
    bundle.entry?.push({ resource: qns }, { resource: makeLabReport([qns]) });

    const xml = buildXml();
    expect(xml).toContain("<td>QNS</td>");
    expect(xml).not.toContain("undefined");
  });

  it("follows hasMember from a panel observation that has no value of its own", () => {
    const a1c = makeA1c();
    const crp = makeCrp();
    const panel = makeObservation({
      status: "final",
      code: { coding: [] },
      dataAbsentReason: { text: "Panel" },
      hasMember: [{ reference: `Observation/${a1c.id}` }, { reference: `Observation/${crp.id}` }],
    });
    const report = makeLabReport([a1c, crp], {
      result: [{ reference: `Observation/${panel.id}` }],
    });
    bundle.entry?.push(
      { resource: a1c },
      { resource: crp },
      { resource: panel },
      { resource: report }
    );

    const xml = buildXml();
    expect(xml).toContain("<td>7.9 %</td>");
    expect(xml).toContain("<td>&lt;0.1 mg/dL</td>");
    expect(xml).not.toContain(`extension="${panel.id}"`);
  });

  it("omits both valueless panels when they share an analyte", () => {
    const a1c = makeA1c();
    const panelCode = { coding: [] };
    const panel1 = makeObservation({
      code: panelCode,
      hasMember: [{ reference: `Observation/${a1c.id}` }],
    });
    const panel2 = makeObservation({
      code: panelCode,
      hasMember: [{ reference: `Observation/${a1c.id}` }],
    });
    const report = makeLabReport([a1c], {
      result: [
        { reference: `Observation/${panel1.id}` },
        { reference: `Observation/${panel2.id}` },
      ],
    });
    bundle.entry?.push(
      { resource: a1c },
      { resource: panel1 },
      { resource: panel2 },
      { resource: report }
    );

    const xml = buildXml();
    expect(xml.match(/<td>7\.9 %<\/td>/g)).toHaveLength(1);
    expect(xml).not.toContain(`extension="${panel1.id}"`);
    expect(xml).not.toContain(`extension="${panel2.id}"`);
  });

  it("does not write a non-UCUM unit into a PQ", () => {
    const obs = makeA1c({ valueQuantity: { value: 25, unit: "customUnits" }, interpretation: [] });
    bundle.entry?.push({ resource: obs }, { resource: makeLabReport([obs]) });

    const xml = buildXml();
    expect(xml).not.toContain(`xsi:type="PQ"`);
    expect(xml).not.toContain(`unit="customUnits"`);
    expect(xml).toContain("<td>25 customUnits</td>");
  });

  it("keeps a valueless panel whose only member is not an Observation", () => {
    const questionnaireResponse = {
      resourceType: "QuestionnaireResponse" as const,
      id: "qr-1",
      status: "completed" as const,
    };
    const panel = makeA1c({ hasMember: [{ reference: "QuestionnaireResponse/qr-1" }] });
    delete panel.valueQuantity;
    const report = makeLabReport([panel]);
    bundle.entry?.push(
      { resource: questionnaireResponse },
      { resource: panel },
      { resource: report }
    );

    const xml = buildXml();
    expect(xml).toContain(`extension="${panel.id}"`);
  });

  it("does not loop on observations that reference each other", () => {
    const a1c = makeA1c();
    const panel = makeObservation({ code: { coding: [] } });
    a1c.hasMember = [{ reference: `Observation/${panel.id}` }];
    panel.hasMember = [{ reference: `Observation/${a1c.id}` }];
    const report = makeLabReport([a1c], { result: [{ reference: `Observation/${panel.id}` }] });
    bundle.entry?.push({ resource: a1c }, { resource: panel }, { resource: report });

    expect(() => buildXml()).not.toThrow();
  });
});
