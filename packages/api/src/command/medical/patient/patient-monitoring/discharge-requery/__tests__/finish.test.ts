import { faker } from "@faker-js/faker";
import { Encounter } from "@medplum/fhirtypes";
import { findMatchingEncounterOrNotifyOfFailure } from "../finish";
import * as sharedModule from "../shared";

describe("processDischargeData", () => {
  let sendSlackNotificationMock: jest.SpyInstance;
  let mockDate: Date;
  const cxId = faker.string.uuid();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDate = new Date("2024-01-01T12:00:00Z");
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    sendSlackNotificationMock = jest.spyOn(sharedModule, "sendNotificationToSlack");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("when no encounters are provided", () => {
    it("should return processing status with appropriate reason", async () => {
      const encounters: Encounter[] = [];

      const result = await findMatchingEncounterOrNotifyOfFailure(encounters, cxId);

      expect(result).toEqual(
        expect.objectContaining({
          status: "processing",
          reason: "No matching encounters found",
          dischargeSummaryFilePath: undefined,
        })
      );
    });
  });

  describe("when multiple encounters are provided", () => {
    it("should return the discharge disposition encounter and completed status", async () => {
      const sourceUrl = faker.internet.url();
      const sourceUrl2 = faker.internet.url();
      const encounterId1 = faker.string.uuid();
      const encounterId2 = faker.string.uuid();
      const encounters: Encounter[] = [
        makeEncounter({
          id: encounterId1,
          meta: {
            source: sourceUrl,
          },
          extension: [],
          hospitalization: {
            dischargeDisposition: {
              coding: [{ code: "home" }],
            },
          },
        }),
        makeEncounter({
          id: encounterId2,
          meta: {
            source: sourceUrl2,
          },
          extension: [],
        }),
      ];

      const result = await findMatchingEncounterOrNotifyOfFailure(encounters, cxId);

      expect(result).toEqual(
        expect.objectContaining({
          status: "completed",
          dischargeSummaryFilePath: sourceUrl,
          reason: "Found a discharge disposition encounter",
          encounterId: encounterId1,
        })
      );
    });

    it("should return failed status and send slack notification when multiple encounters have discharge disposition", async () => {
      const encounterId1 = faker.string.uuid();
      const encounterId2 = faker.string.uuid();
      const encounters: Encounter[] = [
        makeEncounter({
          id: encounterId1,
          hospitalization: {
            dischargeDisposition: {
              coding: [{ code: "home" }],
            },
          },
        }),
        makeEncounter({
          id: encounterId2,
          hospitalization: {
            dischargeDisposition: {
              coding: [{ code: "home" }],
            },
          },
        }),
      ];

      sendSlackNotificationMock.mockImplementationOnce(() => Promise.resolve());
      const result = await findMatchingEncounterOrNotifyOfFailure(encounters, cxId);
      expect(result).toEqual(
        expect.objectContaining({
          status: "failed",
          reason: "Multiple discharge encounters found for the same date",
        })
      );

      expect(sendSlackNotificationMock).toHaveBeenCalledWith(
        "Multiple discharge encounters found for the same date",
        [encounterId1, encounterId2]
      );
    });

    it("should return failed status and send slack notification with multiple encounters that don't have discharge disposition", async () => {
      const encounterId1 = faker.string.uuid();
      const encounterId2 = faker.string.uuid();
      const encounters: Encounter[] = [
        makeEncounter({ id: encounterId1 }),
        makeEncounter({ id: encounterId2 }),
      ];

      sendSlackNotificationMock.mockImplementationOnce(() => Promise.resolve());
      const result = await findMatchingEncounterOrNotifyOfFailure(encounters, cxId);
      expect(result).toEqual(
        expect.objectContaining({
          status: "failed",
          reason: "Multiple encounters found for the same date",
        })
      );

      expect(sendSlackNotificationMock).toHaveBeenCalledWith(
        "Multiple encounters found for the same date",
        [encounterId1, encounterId2]
      );
    });
  });

  describe("when single encounter is provided", () => {
    it("should return completed status with the source url for a discharge disposition encounter", async () => {
      const sourceUrl = faker.internet.url();
      const encounters: Encounter[] = [
        makeEncounter({
          id: faker.string.uuid(),
          meta: {
            source: sourceUrl,
          },
          hospitalization: {
            dischargeDisposition: {
              coding: [{ code: "home" }],
            },
          },
        }),
      ];

      const result = await findMatchingEncounterOrNotifyOfFailure(encounters, cxId);
      expect(result).toEqual(
        expect.objectContaining({
          status: "completed",
          dischargeSummaryFilePath: sourceUrl,
          reason: "Found a discharge disposition encounter",
        })
      );
    });

    it("should return completed status with the source url", async () => {
      const sourceUrl = faker.internet.url();
      const encounters: Encounter[] = [
        makeEncounter({
          id: faker.string.uuid(),
          meta: {
            source: sourceUrl,
          },
          extension: [],
        }),
      ];

      const result = await findMatchingEncounterOrNotifyOfFailure(encounters, cxId);
      expect(result).toEqual(
        expect.objectContaining({
          status: "completed",
          dischargeSummaryFilePath: sourceUrl,
          reason: "Matching encounter datetime",
        })
      );
    });
  });
});

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
