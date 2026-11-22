import { Bundle, DiagnosticReport, Observation } from "@medplum/fhirtypes";
import { XMLValidator } from "fast-xml-parser";
import { generateCdaFromFhirBundle } from "../../../cda-generators";
import { removeEmptyFields } from "../../clinical-document/clinical-document";
import { xmlBuilder } from "../../clinical-document/shared";
import { buildVariousNotesAndResults } from "../notes-and-results";
import { makeDiagnosticReport } from "./make-diagnostic-report";
import { makeObservation } from "./make-observation";
import { makeOrganization } from "./make-organization";
import { makePatient } from "./make-patient";
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

  it("does not add a placeholder Note row for a lab report's attached document", () => {
    const a1c = makeA1c();
    const report = makeLabReport([a1c], {
      presentedForm: [{ contentType: "application/pdf", url: "https://example.com/report.pdf" }],
    });
    bundle.entry?.push({ resource: a1c }, { resource: report });

    const xml = buildXml();
    expect(xml).toContain("<td>7.9 %</td>");
    expect(xml).not.toContain("<td>Note</td>");
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

  it("names a coded value by its code when no coding has a display", () => {
    const blood = makeA1c({
      interpretation: [],
      valueCodeableConcept: { coding: [{ system: "http://snomed.info/sct", code: "260385009" }] },
    });
    delete blood.valueQuantity;
    bundle.entry?.push({ resource: blood }, { resource: makeLabReport([blood]) });

    const xml = buildXml();
    expect(xml).toContain("<td>260385009</td>");
  });

  it("prefers a later coding's display over the concept text", () => {
    const blood = makeA1c({
      interpretation: [],
      valueCodeableConcept: {
        text: "neg",
        coding: [
          { system: "urn:oid:1.2.3", code: "N1" },
          { system: "http://snomed.info/sct", code: "260385009", display: "Negative" },
        ],
      },
    });
    delete blood.valueQuantity;
    bundle.entry?.push({ resource: blood }, { resource: makeLabReport([blood]) });

    const xml = buildXml();
    expect(xml).toContain("<td>Negative</td>");
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

describe("generateCdaFromFhirBundle - results", () => {
  it("produces valid XML when a result has a comparator", () => {
    const patient = makePatient();
    const organization = makeOrganization();
    const crp = makeCrp({ subject: { reference: `Patient/${patient.id}` } });
    const textCrp = makeCrp({ subject: { reference: `Patient/${patient.id}` } });
    delete textCrp.valueQuantity;
    textCrp.valueString = "<0.1 mg/dL";
    bundle.entry?.push(
      { resource: patient },
      { resource: organization },
      { resource: crp },
      { resource: textCrp },
      { resource: makeLabReport([crp, textCrp]) }
    );

    const xml = generateCdaFromFhirBundle("cx-id", bundle, "1.2.3", true);
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain("<td>&lt;0.1 mg/dL</td>");
  });

  it("keeps an off scale low interpretation code escaped in its attribute", () => {
    const patient = makePatient();
    const organization = makeOrganization();
    const crp = makeCrp({
      subject: { reference: `Patient/${patient.id}` },
      interpretation: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
              code: "<",
              display: "Off scale low",
            },
          ],
        },
      ],
    });
    bundle.entry?.push(
      { resource: patient },
      { resource: organization },
      { resource: crp },
      { resource: makeLabReport([crp]) }
    );

    const xml = generateCdaFromFhirBundle("cx-id", bundle, "1.2.3", true);
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain(`<interpretationCode code="&lt;"`);
  });

  it.each([
    ["Results", "lab report"],
    ["Progress Notes", "progress note"],
  ])("restores a multiline note's table as one unit in %s", (_section, kind) => {
    const patient = makePatient();
    const organization = makeOrganization();
    const subject = { reference: `Patient/${patient.id}` };
    const html = '<table border="1">\n<tr><td>Glucose</td></tr>\n</table>';
    const presentedForm = [
      { contentType: "text/html", data: Buffer.from(html).toString("base64") },
    ];
    const a1c = makeA1c({ subject });
    const report =
      kind === "lab report"
        ? makeLabReport([a1c], { subject, presentedForm })
        : makeDiagnosticReport({
            status: "final",
            subject,
            code: {
              coding: [{ system: "http://loinc.org", code: "11506-3", display: "Progress note" }],
            },
            effectiveDateTime,
            presentedForm,
          });
    bundle.entry?.push(
      { resource: patient },
      { resource: organization },
      { resource: a1c },
      { resource: report }
    );

    const xml = generateCdaFromFhirBundle("cx-id", bundle, "1.2.3", true);
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(xml).toContain('<table border="1"><br/><tr><td>Glucose</td></tr><br/></table>');
    expect(xml).not.toContain("&lt;table");
  });

  it.each([
    ["a plain table", '<table border="1"><tr><td>Plan</td><td>Rest</td></tr></table>', true],
    [
      "an apostrophe in a double-quoted attribute",
      `<table><tr><td title="Patient's result">Normal</td></tr></table>`,
      true,
    ],
    ["a single-quoted attribute", "<table><tr><td>Dose<br title='Dose'/></td></tr></table>", true],
    [
      "a double quote in a single-quoted attribute",
      `<table><tr><td title='say "hi"'>x</td></tr></table>`,
      true,
    ],
    ["an unclosed br", "<table><tr><td>line one<br>line two</td></tr></table>", true],
    ["a > inside an attribute", '<table><tr><td title="a > b">x</td></tr></table>', true],
    ["a < inside an attribute", '<table><tr><td title="a < b">x</td></tr></table>', true],
    ["an unclosed hr", "<table><tr><td>x</td></tr></table><hr>", false],
    ["a less-than value in a cell", "<table><tr><td><5 mg</td></tr></table>", false],
    ["an attribute with no value", "<table><tr><td nowrap>x</td></tr></table>", false],
    ["an HTML entity", "<table><tr><td>a&nbsp;b</td></tr></table>", false],
    ["unbalanced tags", "<table><tr><td>x</table>", false],
    ["a comment", "<table><tr><td>x</td></tr></table><!-- note -->", true],
    ["a CDATA section", "<table><tr><td>x</td></tr></table><![CDATA[raw]]>", true],
  ])("keeps the CCD valid for a note with %s", (_label, html, rendersAsMarkup) => {
    const patient = makePatient();
    const organization = makeOrganization();
    const note = makeDiagnosticReport({
      status: "final",
      subject: { reference: `Patient/${patient.id}` },
      code: { coding: [{ system: "http://loinc.org", code: "11506-3", display: "Progress note" }] },
      effectiveDateTime,
      presentedForm: [{ contentType: "text/html", data: Buffer.from(html).toString("base64") }],
    });
    bundle.entry?.push({ resource: patient }, { resource: organization }, { resource: note });

    const xml = generateCdaFromFhirBundle("cx-id", bundle, "1.2.3", true);
    expect(XMLValidator.validate(xml)).toBe(true);
    if (rendersAsMarkup) expect(xml).toMatch(/<td[ >]/);
  });

  it.each([
    ["plain text", "Ratio ]]> 1"],
    ["a table", "<table><tr><td>Ratio ]]> 1</td></tr></table>"],
  ])('keeps "]]>" escaped in %s', (_label, html) => {
    const patient = makePatient();
    const organization = makeOrganization();
    const note = makeDiagnosticReport({
      status: "final",
      subject: { reference: `Patient/${patient.id}` },
      code: { coding: [{ system: "http://loinc.org", code: "11506-3", display: "Progress note" }] },
      effectiveDateTime,
      presentedForm: [{ contentType: "text/html", data: Buffer.from(html).toString("base64") }],
    });
    bundle.entry?.push({ resource: patient }, { resource: organization }, { resource: note });

    const xml = generateCdaFromFhirBundle("cx-id", bundle, "1.2.3", true);
    expect(xml).toContain("Ratio ]]&gt; 1");
    expect(xml).not.toContain("]]>");
  });

  it.each([
    ["a double hyphen", "<!-- a -- b -->"],
    ["a trailing hyphen", "<!-- a --->"],
  ])("keeps a comment with %s escaped", (_label, comment) => {
    const patient = makePatient();
    const organization = makeOrganization();
    const html = `<table><tr><td>x</td></tr></table>${comment}`;
    const note = makeDiagnosticReport({
      status: "final",
      subject: { reference: `Patient/${patient.id}` },
      code: { coding: [{ system: "http://loinc.org", code: "11506-3", display: "Progress note" }] },
      effectiveDateTime,
      presentedForm: [{ contentType: "text/html", data: Buffer.from(html).toString("base64") }],
    });
    bundle.entry?.push({ resource: patient }, { resource: organization }, { resource: note });

    const xml = generateCdaFromFhirBundle("cx-id", bundle, "1.2.3", true);
    expect(xml).toMatch(/<td>x<\/td>/);
    expect(xml).toContain(comment.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    expect(xml).not.toContain("<!--");
  });
});
