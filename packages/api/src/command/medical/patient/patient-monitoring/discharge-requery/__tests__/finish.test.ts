import { faker } from "@faker-js/faker";
import { Encounter } from "@medplum/fhirtypes";
import * as slackModule from "@metriport/core/external/slack/index";
import * as configModule from "@metriport/core/util/config";
import { DischargeData } from "@metriport/shared/domain/patient/patient-monitoring/discharge-requery";
import { processDischargeData } from "../finish";

describe("processDischargeData", () => {
  const fakeSlackUrl = "https://some-discharge-notification-url";
  let sendToSlackMock: jest.SpyInstance;
  let getDischargeNotificationSlackUrlMock: jest.SpyInstance;
  let mockLog: jest.Mock;
  let dischargeData: DischargeData;
  let mockDate: Date;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDate = new Date("2024-01-01T12:00:00Z");
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    sendToSlackMock = jest.spyOn(slackModule, "sendToSlack");
    getDischargeNotificationSlackUrlMock = jest.spyOn(
      configModule.Config,
      "getDischargeNotificationSlackUrl"
    );

    mockLog = jest.fn();
    dischargeData = {
      encounterEndDate: "2024-01-01T12:00:00Z",
      type: "findDischargeSummary",
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("when no encounters are provided", () => {
    it("should return processing status with appropriate reason", async () => {
      const encounters: Encounter[] = [];

      const result = await processDischargeData(encounters, dischargeData, mockLog);

      expect(result).toEqual({
        discharge: dischargeData,
        status: "processing",
        reason: "No matching encounters found",
      });
    });
  });

  describe("when multiple encounters are provided", () => {
    it("should return failed status and send slack notification", async () => {
      const encounterId1 = faker.string.uuid();
      const encounterId2 = faker.string.uuid();
      const encounters: Encounter[] = [
        makeEncounter({ id: encounterId1 }),
        makeEncounter({ id: encounterId2 }),
      ];

      getDischargeNotificationSlackUrlMock.mockReturnValueOnce(fakeSlackUrl);

      sendToSlackMock.mockImplementationOnce(() => Promise.resolve());
      const result = await processDischargeData(encounters, dischargeData, mockLog);

      expect(result).toEqual({
        discharge: dischargeData,
        status: "failed",
        reason: "Multiple encounters found for the same date",
      });

      expect(mockLog).toHaveBeenCalledWith(
        `Multiple encounters found for the same date for encounters: ${JSON.stringify([
          encounterId1,
          encounterId2,
        ])}`
      );

      expect(sendToSlackMock).toHaveBeenCalledWith(
        {
          subject: "Multiple encounters found for the same date",
          message: JSON.stringify([encounterId1, encounterId2], null, 2),
          emoji: ":peepo_hey:",
        },
        fakeSlackUrl
      );
    });
  });

  describe("when single encounter is provided", () => {
    it("should return failed status when encounter has no source", async () => {
      const encounters: Encounter[] = [
        makeEncounter({
          id: faker.string.uuid(),
          meta: {},
          extension: [],
        }),
      ];

      const result = await processDischargeData(encounters, dischargeData, mockLog);

      expect(result).toEqual({
        discharge: dischargeData,
        status: "failed",
        reason: "Encounter resource missing source",
      });
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

      const result = await processDischargeData(encounters, dischargeData, mockLog);

      expect(result).toEqual({
        discharge: dischargeData,
        status: "completed",
        dischargeSummaryFilePath: sourceUrl,
        reason: "Matching encounter datetime",
      });
    });

    it("should return completed status with the source url and discharge disposition", async () => {
      const sourceUrl = faker.internet.url();
      const encounters: Encounter[] = [
        makeEncounter({
          id: faker.string.uuid(),
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
      ];

      const result = await processDischargeData(encounters, dischargeData, mockLog);

      expect(result).toEqual({
        discharge: dischargeData,
        status: "completed",
        dischargeSummaryFilePath: sourceUrl,
        reason: "Discharge disposition found in encounter",
      });
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
