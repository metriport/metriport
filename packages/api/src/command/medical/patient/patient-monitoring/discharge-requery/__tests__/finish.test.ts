import { faker } from "@faker-js/faker";
import { Encounter, Extension } from "@medplum/fhirtypes";
import * as consolidatedGetModule from "@metriport/core/command/consolidated/consolidated-get";
import { DOC_ID_EXTENSION_URL } from "@metriport/core/external/fhir/shared/extensions/doc-id-extension";
import { XML_FILE_EXTENSION } from "@metriport/core/util/mime";
import { DischargeData } from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import {
  getMatchingEncountersWithSummaryPath,
  processDischargeSummaryAssociation,
} from "../finish";
import * as sharedModule from "../shared";

function makeDocIdFhirExtension(docId: string): Extension {
  return {
    url: DOC_ID_EXTENSION_URL,
    valueString: docId,
  };
}

describe("processDischargeSummaryAssociation", () => {
  const dischargeSummaryPath1 = `${faker.system.filePath()}.${XML_FILE_EXTENSION}`;
  const dischargeSummaryPath2 = `${faker.system.filePath()}.${XML_FILE_EXTENSION}`;

  let sendSlackNotificationMock: jest.SpyInstance;
  let getConsolidatedFileMock: jest.SpyInstance;
  let mockDate: Date;
  const cxId = faker.string.uuid();
  const patientId = faker.string.uuid();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDate = new Date("2024-01-01T12:00:00Z");
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    sendSlackNotificationMock = jest.spyOn(sharedModule, "sendNotificationToSlack");
    getConsolidatedFileMock = jest.spyOn(consolidatedGetModule, "getConsolidatedFile");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getMatchingEncountersWithSummaryPath", () => {
    it("should return empty array when no encounters match", () => {
      const encounters: Encounter[] = [];
      const dischargeData = makeDischargeData();

      const result = getMatchingEncountersWithSummaryPath(encounters, dischargeData);

      expect(result).toEqual([]);
    });

    it("should return matching encounters with discharge summary file paths", () => {
      const encounterId1 = faker.string.uuid();
      const encounterId2 = faker.string.uuid();
      const encounterEndDate = "2024-01-01T12:00:00Z";

      const encounters: Encounter[] = [
        makeEncounter({
          id: encounterId1,
          period: {
            start: "2024-01-01T10:00:00Z",
            end: encounterEndDate,
          },
          extension: [makeDocIdFhirExtension(dischargeSummaryPath1)],
        }),
        makeEncounter({
          id: encounterId2,
          period: {
            start: "2024-01-01T11:00:00Z",
            end: encounterEndDate,
          },
          extension: [makeDocIdFhirExtension(dischargeSummaryPath2)],
        }),
        makeEncounter({
          id: faker.string.uuid(),
          period: {
            start: "2024-01-01T09:00:00Z",
            end: "2024-01-01T11:00:00Z", // Different end date
          },
        }),
      ];

      const dischargeData = makeDischargeData({
        encounterEndDate,
        tcmEncounterId: faker.string.uuid(),
      });

      const result = getMatchingEncountersWithSummaryPath(encounters, dischargeData);

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          {
            id: encounterId1,
            dischargeSummaryFilePath: dischargeSummaryPath1,
            encounter: expect.objectContaining({
              id: encounterId1,
              period: expect.objectContaining({
                end: encounterEndDate,
              }),
            }),
          },
          {
            id: encounterId2,
            dischargeSummaryFilePath: dischargeSummaryPath2,
            encounter: expect.objectContaining({
              id: encounterId2,
              period: expect.objectContaining({
                end: encounterEndDate,
              }),
            }),
          },
        ])
      );
    });

    it("should filter encounters that don't have discharge summary file paths", () => {
      const encounterId = faker.string.uuid();
      const encounterEndDate = "2024-01-01T12:00:00Z";

      const encounters: Encounter[] = [
        makeEncounter({
          id: encounterId,
          period: {
            start: "2024-01-01T10:00:00Z",
            end: encounterEndDate,
          },
          extension: [makeDocIdFhirExtension("some-other-file.txt")], // Not XML file
        }),
      ];

      const dischargeData = makeDischargeData({
        encounterEndDate,
      });

      const result = getMatchingEncountersWithSummaryPath(encounters, dischargeData);

      expect(result).toEqual([]);
    });
  });

  describe("processDischargeSummaryAssociation", () => {
    it("should return processing status when no consolidated file is found", async () => {
      getConsolidatedFileMock.mockResolvedValueOnce({ bundle: null });

      const dischargeData = [makeDischargeData()];

      const result = await processDischargeSummaryAssociation({
        dischargeData,
        cxId,
        patientId,
      });

      expect(result).toEqual({
        processing: [
          {
            discharge: dischargeData[0],
            status: "processing",
            reason: "No consolidated file found",
          },
        ],
        completed: [],
      });
    });

    it("should return completed status when matching encounter is found", async () => {
      const encounterId = faker.string.uuid();
      const dischargeSummaryPath = `${faker.system.filePath()}.${XML_FILE_EXTENSION}`;
      const encounterEndDate = "2024-01-01T12:00:00Z";

      const encounters: Encounter[] = [
        makeEncounter({
          id: encounterId,
          period: {
            start: "2024-01-01T10:00:00Z",
            end: encounterEndDate,
          },
          extension: [makeDocIdFhirExtension(dischargeSummaryPath)],
        }),
      ];

      getConsolidatedFileMock.mockResolvedValueOnce({
        bundle: {
          resourceType: "Bundle",
          entry: encounters.map(encounter => ({ resource: encounter })),
        },
      });

      const dischargeData = [makeDischargeData({ encounterEndDate })];

      const result = await processDischargeSummaryAssociation({
        dischargeData,
        cxId,
        patientId,
      });

      expect(result).toEqual({
        processing: [],
        completed: [
          {
            discharge: dischargeData[0],
            status: "completed",
            reason: "Found a discharge encounter",
            encounterId,
            dischargeSummaryFilePath: dischargeSummaryPath,
          },
        ],
      });
    });

    it("should return processing status when no matching encounters are found", async () => {
      const encounters: Encounter[] = [
        makeEncounter({
          period: {
            start: "2024-01-01T10:00:00Z",
            end: "2024-01-01T11:00:00Z", // Different end date
          },
        }),
      ];

      getConsolidatedFileMock.mockResolvedValueOnce({
        bundle: {
          resourceType: "Bundle",
          entry: encounters.map(encounter => ({ resource: encounter })),
        },
      });

      const dischargeData = [makeDischargeData({ encounterEndDate: "2024-01-01T12:00:00Z" })];

      const result = await processDischargeSummaryAssociation({
        dischargeData,
        cxId,
        patientId,
      });

      expect(result).toEqual({
        processing: [
          {
            discharge: dischargeData[0],
            status: "processing",
            reason: "No matching encounters found",
          },
        ],
        completed: [],
      });
    });

    it("should handle multiple discharge data and send slack notification for multiple matches", async () => {
      const encounterId1 = faker.string.uuid();
      const encounterId2 = faker.string.uuid();
      const encounterEndDate = "2024-01-01T12:00:00Z";

      const encounters: Encounter[] = [
        makeEncounter({
          id: encounterId1,
          period: {
            start: "2024-01-01T10:00:00Z",
            end: encounterEndDate,
          },
          extension: [makeDocIdFhirExtension(dischargeSummaryPath1)],
          hospitalization: {
            dischargeDisposition: {
              coding: [{ code: "home" }],
            },
          },
        }),
        makeEncounter({
          id: encounterId2,
          period: {
            start: "2024-01-01T11:00:00Z",
            end: encounterEndDate,
          },
          extension: [makeDocIdFhirExtension(dischargeSummaryPath2)],
        }),
      ];

      getConsolidatedFileMock.mockResolvedValueOnce({
        bundle: {
          resourceType: "Bundle",
          entry: encounters.map(encounter => ({ resource: encounter })),
        },
      });

      sendSlackNotificationMock.mockImplementationOnce(() => Promise.resolve());

      const dischargeData = [makeDischargeData({ encounterEndDate })];

      const result = await processDischargeSummaryAssociation({
        dischargeData,
        cxId,
        patientId,
      });

      expect(result.completed).toHaveLength(1);
      expect(result.completed[0]).toEqual(
        expect.objectContaining({
          status: "completed",
          reason: "Multiple discharge encounter matches found",
          encounterId: encounterId1, // Should prefer the one with discharge disposition
          dischargeSummaryFilePath: dischargeSummaryPath1,
        })
      );

      expect(sendSlackNotificationMock).toHaveBeenCalledTimes(1);
      const [subject, message] = sendSlackNotificationMock.mock.calls[0];
      expect(subject).toBe("Multiple discharge encounter matches found");
      expect(message).toContain(patientId);
      expect(message).toContain(cxId);
      expect(message).toContain("numberOfMatches");
      expect(message).toContain("2");
    });
  });
});

function makeDischargeData(params: Partial<DischargeData> = {}): DischargeData {
  return {
    encounterEndDate: params.encounterEndDate ?? "2024-01-01T12:00:00Z",
    tcmEncounterId: params.tcmEncounterId ?? faker.string.uuid(),
  };
}

function makeEncounter(params: Partial<Encounter> = {}): Encounter {
  return {
    resourceType: "Encounter",
    id: params.id ?? faker.string.uuid(),
    status: params.status ?? "finished",
    class: params.class ?? {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory",
    },
    subject: params.subject ?? {
      reference: `Patient/${faker.string.uuid()}`,
    },
    period: params.period ?? {
      start: "2024-01-01T10:00:00Z",
      end: "2024-01-01T12:00:00Z",
    },
    meta: params.meta,
    extension: params.extension,
    hospitalization: params.hospitalization,
    ...params,
  };
}
