import { faker } from "@faker-js/faker";
import {
  Composition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  Extension,
} from "@medplum/fhirtypes";
import * as consolidatedGetModule from "@metriport/core/command/consolidated/consolidated-get";
import { DISCHARGE_DISPOSITION_SYSTEM } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/adt/mappings";
import { DOC_ID_EXTENSION_URL } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { XML_FILE_EXTENSION } from "@metriport/core/util/mime";
import { DischargeData } from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import { processDischargeSummaryAssociation } from "../finish";

function makeDocIdFhirExtension(docId: string): Extension {
  return {
    url: DOC_ID_EXTENSION_URL,
    valueString: docId,
  };
}

describe("processDischargeSummaryAssociation", () => {
  const dischargeSummaryPath = `${faker.string.uuid()}.${XML_FILE_EXTENSION}`;

  let getConsolidatedFileMock: jest.SpyInstance;
  const cxId = faker.string.uuid();
  const patientId = faker.string.uuid();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    getConsolidatedFileMock = jest.spyOn(consolidatedGetModule, "getConsolidatedFile");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns processing when no consolidated file", async () => {
    getConsolidatedFileMock.mockResolvedValueOnce({ bundle: null });
    const dischargeData = [makeDischargeData()];

    const result = await processDischargeSummaryAssociation({ dischargeData, cxId, patientId });

    expect(result.processing).toHaveLength(1);
    expect(result.processing[0]?.reason).toBe("No consolidated file found");
    expect(result.completed).toHaveLength(0);
  });

  it("returns completed when matching encounter and discharge summary found and no requeries remaining", async () => {
    const encounterId = faker.string.uuid();
    const encounterEndDate = "2024-01-01T12:00:00Z";

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: "2024-01-01T10:00:00Z", end: encounterEndDate },
            }),
          },
          {
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T11:00:00Z",
              extension: [makeDocIdFhirExtension(dischargeSummaryPath)],
              presentedForm: [{ data: Buffer.from("discharge summary").toString("base64") }],
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.encounterId).toBe(encounterId);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(dischargeSummaryPath);
    expect(result.processing).toHaveLength(0);
  });

  it("returns processing with requery when discharge summary found but requeries remaining", async () => {
    const encounterId = faker.string.uuid();
    const encounterEndDate = "2024-01-01T12:00:00Z";

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: "2024-01-01T10:00:00Z", end: encounterEndDate },
            }),
          },
          {
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T11:00:00Z",
              extension: [makeDocIdFhirExtension(dischargeSummaryPath)],
              presentedForm: [{ data: Buffer.from("discharge summary").toString("base64") }],
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate })],
      cxId,
      patientId,
    });

    expect(result.processing).toHaveLength(1);
    expect(result.processing[0]?.discharge.dischargeRequeriesRemaining).toBe(3);
    expect(result.completed).toHaveLength(0);
  });

  it("returns processing when no matching encounter", async () => {
    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              period: { start: "2024-01-01T10:00:00Z", end: "2024-01-01T11:00:00Z" },
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate: "2024-01-01T12:00:00Z" })],
      cxId,
      patientId,
    });

    expect(result.processing).toHaveLength(1);
    expect(result.processing[0]?.reason).toBe("No matching encounter found");
    expect(result.completed).toHaveLength(0);
  });

  it("returns processing when no discharge summary document", async () => {
    const encounterEndDate = "2024-01-01T12:00:00Z";

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              period: { start: "2024-01-01T10:00:00Z", end: encounterEndDate },
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate })],
      cxId,
      patientId,
    });

    expect(result.processing).toHaveLength(1);
    expect(result.processing[0]?.reason).toBe("No discharge summary document found");
    expect(result.completed).toHaveLength(0);
  });

  it("falls back to encounter with discharge disposition when no discharge summary document found", async () => {
    const encounterId = faker.string.uuid();
    const encounterEndDate = "2024-01-01T12:00:00Z";
    const encounterXmlPath = `encounter.${XML_FILE_EXTENSION}`;

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: "2024-01-01T10:00:00Z", end: encounterEndDate },
              extension: [makeDocIdFhirExtension(encounterXmlPath)],
              hospitalization: {
                dischargeDisposition: {
                  coding: [{ system: DISCHARGE_DISPOSITION_SYSTEM, code: "home" }],
                },
              },
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.encounterId).toBe(encounterId);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(encounterXmlPath);
    expect(result.processing).toHaveLength(0);
  });

  it("returns best match: highest term score wins over proximity", async () => {
    const encounterId = faker.string.uuid();
    const encounterStartDate = "2024-01-01T00:00:00Z";
    const encounterEndDate = "2024-01-01T12:00:00Z";
    const bestPath = `best.${XML_FILE_EXTENSION}`;
    const worsePath = `worse.${XML_FILE_EXTENSION}`;

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: encounterStartDate, end: encounterEndDate },
            }),
          },
          {
            // "dischargesummary" (score 30) but very close to discharge
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T11:59:00Z",
              extension: [makeDocIdFhirExtension(worsePath)],
              presentedForm: [{ data: Buffer.from("dischargesummary content").toString("base64") }],
            }),
          },
          {
            // "discharge summary" (score 40) but further from discharge - should still win
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T06:00:00Z",
              extension: [makeDocIdFhirExtension(bestPath)],
              presentedForm: [
                { data: Buffer.from("discharge summary content").toString("base64") },
              ],
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(bestPath);
  });

  it("returns best match: closer to discharge wins when same term score", async () => {
    const encounterId = faker.string.uuid();
    const encounterStartDate = "2024-01-01T00:00:00Z";
    const encounterEndDate = "2024-01-01T12:00:00Z";
    const closerPath = `closer.${XML_FILE_EXTENSION}`;
    const furtherPath = `further.${XML_FILE_EXTENSION}`;

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: encounterStartDate, end: encounterEndDate },
            }),
          },
          {
            // "discharge summary" (score 40) but far from discharge
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T02:00:00Z",
              extension: [makeDocIdFhirExtension(furtherPath)],
              presentedForm: [{ data: Buffer.from("discharge summary early").toString("base64") }],
            }),
          },
          {
            // "discharge summary" (score 40) and close to discharge - should win
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T11:00:00Z",
              extension: [makeDocIdFhirExtension(closerPath)],
              presentedForm: [{ data: Buffer.from("discharge summary late").toString("base64") }],
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(closerPath);
  });

  it("returns best match: fewer encounters wins when same content score", async () => {
    const encounterId = faker.string.uuid();
    const encounterStartDate = "2024-01-01T00:00:00Z";
    const encounterEndDate = "2024-01-01T12:00:00Z";
    const fewerEncountersPath = `fewer.${XML_FILE_EXTENSION}`;
    const moreEncountersPath = `more.${XML_FILE_EXTENSION}`;

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: encounterStartDate, end: encounterEndDate },
            }),
          },
          {
            // "discharge summary" with 3 encounters - should lose
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T11:59:00Z", // closer to discharge
              extension: [makeDocIdFhirExtension(moreEncountersPath)],
              presentedForm: [{ data: Buffer.from("discharge summary").toString("base64") }],
            }),
          },
          {
            resource: makeComposition({
              extension: [makeDocIdFhirExtension(moreEncountersPath)],
              encounter: { reference: "Encounter/enc1" },
              section: [
                { entry: [{ reference: "Encounter/enc2" }, { reference: "Encounter/enc3" }] },
              ],
            }),
          },
          {
            // "discharge summary" with 1 encounter - should win despite being further from discharge
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T06:00:00Z", // further from discharge
              extension: [makeDocIdFhirExtension(fewerEncountersPath)],
              presentedForm: [{ data: Buffer.from("discharge summary").toString("base64") }],
            }),
          },
          {
            resource: makeComposition({
              extension: [makeDocIdFhirExtension(fewerEncountersPath)],
              encounter: { reference: "Encounter/enc1" },
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(fewerEncountersPath);
  });

  it("returns best match: content score dominates composition score", async () => {
    const encounterId = faker.string.uuid();
    const encounterStartDate = "2024-01-01T00:00:00Z";
    const encounterEndDate = "2024-01-01T12:00:00Z";
    const higherContentPath = `higher-content.${XML_FILE_EXTENSION}`;
    const lowerContentPath = `lower-content.${XML_FILE_EXTENSION}`;

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: encounterStartDate, end: encounterEndDate },
            }),
          },
          {
            // "dischargesummary" (score 30) with 1 encounter (best composition) - should lose
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T11:59:00Z",
              extension: [makeDocIdFhirExtension(lowerContentPath)],
              presentedForm: [{ data: Buffer.from("dischargesummary").toString("base64") }],
            }),
          },
          {
            resource: makeComposition({
              extension: [makeDocIdFhirExtension(lowerContentPath)],
              encounter: { reference: "Encounter/enc1" },
            }),
          },
          {
            // "discharge summary" (score 40) with 5+ encounters (worst composition) - should still win
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T06:00:00Z",
              extension: [makeDocIdFhirExtension(higherContentPath)],
              presentedForm: [{ data: Buffer.from("discharge summary").toString("base64") }],
            }),
          },
          {
            resource: makeComposition({
              extension: [makeDocIdFhirExtension(higherContentPath)],
              section: [
                {
                  entry: [
                    { reference: "Encounter/enc1" },
                    { reference: "Encounter/enc2" },
                    { reference: "Encounter/enc3" },
                    { reference: "Encounter/enc4" },
                    { reference: "Encounter/enc5" },
                  ],
                },
              ],
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(higherContentPath);
  });

  it("returns completed when DocumentReference with discharge instructions code found", async () => {
    const encounterId = faker.string.uuid();
    const encounterEndDate = "2024-01-01T12:00:00Z";
    const docRefPath = `doc-ref.${XML_FILE_EXTENSION}`;

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: "2024-01-01T10:00:00Z", end: encounterEndDate },
            }),
          },
          {
            resource: makeDocumentReference({
              date: "2024-01-01T11:00:00Z",
              content: [{ attachment: { title: docRefPath } }],
              type: { coding: [{ system: "http://loinc.org", code: "74213-0" }] },
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.encounterId).toBe(encounterId);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(docRefPath);
  });

  it("returns completed with DocumentReference using category code", async () => {
    const encounterId = faker.string.uuid();
    const encounterEndDate = "2024-01-01T12:00:00Z";
    const docRefPath = `doc-ref-category.${XML_FILE_EXTENSION}`;

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: "2024-01-01T10:00:00Z", end: encounterEndDate },
            }),
          },
          {
            resource: makeDocumentReference({
              date: "2024-01-01T11:00:00Z",
              content: [{ attachment: { title: docRefPath } }],
              category: [{ coding: [{ system: "http://loinc.org", code: "72170-4" }] }],
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.encounterId).toBe(encounterId);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(docRefPath);
  });

  it("prefers DiagnosticReport with higher score over DocumentReference", async () => {
    const encounterId = faker.string.uuid();
    const encounterStartDate = "2024-01-01T00:00:00Z";
    const encounterEndDate = "2024-01-01T12:00:00Z";
    const drPath = `diag-report.${XML_FILE_EXTENSION}`;
    const docRefPath = `doc-ref.${XML_FILE_EXTENSION}`;

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: encounterStartDate, end: encounterEndDate },
            }),
          },
          {
            resource: makeDocumentReference({
              date: "2024-01-01T11:59:00Z",
              content: [{ attachment: { title: docRefPath } }],
              type: { coding: [{ system: "http://loinc.org", code: "74213-0" }] },
            }),
          },
          {
            resource: makeDiagnosticReport({
              effectiveDateTime: "2024-01-01T11:00:00Z",
              extension: [makeDocIdFhirExtension(drPath)],
              presentedForm: [{ data: Buffer.from("discharge summary").toString("base64") }],
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(drPath);
  });

  it("ignores DocumentReference without discharge instructions code", async () => {
    const encounterId = faker.string.uuid();
    const encounterEndDate = "2024-01-01T12:00:00Z";

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: "2024-01-01T10:00:00Z", end: encounterEndDate },
            }),
          },
          {
            resource: makeDocumentReference({
              date: "2024-01-01T11:00:00Z",
              content: [{ attachment: { title: `random.${XML_FILE_EXTENSION}` } }],
              type: { coding: [{ system: "http://loinc.org", code: "some-other-code" }] },
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate })],
      cxId,
      patientId,
    });

    expect(result.processing).toHaveLength(1);
    expect(result.processing[0]?.reason).toBe("No discharge summary document found");
    expect(result.completed).toHaveLength(0);
  });

  it("uses DocumentReference context.period for time range check", async () => {
    const encounterId = faker.string.uuid();
    const encounterEndDate = "2024-01-01T12:00:00Z";
    const docRefPath = `doc-ref-period.${XML_FILE_EXTENSION}`;

    getConsolidatedFileMock.mockResolvedValueOnce({
      bundle: {
        resourceType: "Bundle",
        entry: [
          {
            resource: makeEncounter({
              id: encounterId,
              period: { start: "2024-01-01T10:00:00Z", end: encounterEndDate },
            }),
          },
          {
            resource: makeDocumentReference({
              context: { period: { start: "2024-01-01T11:00:00Z" } },
              content: [{ attachment: { title: docRefPath } }],
              type: { coding: [{ system: "http://loinc.org", code: "74213-0" }] },
            }),
          },
        ],
      },
    });

    const result = await processDischargeSummaryAssociation({
      dischargeData: [makeDischargeData({ encounterEndDate, dischargeRequeriesRemaining: 1 })],
      cxId,
      patientId,
    });

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0]?.dischargeSummaryFilePath).toBe(docRefPath);
  });
});

function makeDischargeData(params: Partial<DischargeData> = {}): DischargeData {
  return {
    encounterEndDate: params.encounterEndDate ?? "2024-01-01T12:00:00Z",
    tcmEncounterId: params.tcmEncounterId ?? faker.string.uuid(),
    ...params,
  };
}

function makeEncounter(params: Partial<Encounter> = {}): Encounter {
  return {
    resourceType: "Encounter",
    id: params.id ?? faker.string.uuid(),
    status: "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB" },
    ...params,
  };
}

function makeDiagnosticReport(params: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    resourceType: "DiagnosticReport",
    id: params.id ?? faker.string.uuid(),
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: "11506-3" }] },
    ...params,
  };
}

function makeComposition(params: Partial<Composition> = {}): Composition {
  return {
    resourceType: "Composition",
    id: params.id ?? faker.string.uuid(),
    status: "final",
    type: { coding: [{ system: "http://loinc.org", code: "11506-3" }] },
    date: "2024-01-01",
    author: [{ reference: "Practitioner/1" }],
    title: "Test Composition",
    ...params,
  };
}

function makeDocumentReference(params: Partial<DocumentReference> = {}): DocumentReference {
  return {
    resourceType: "DocumentReference",
    id: params.id ?? faker.string.uuid(),
    status: "current",
    ...params,
  };
}
