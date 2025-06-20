import { utcifyHl7Message } from "../datetime";
import { makeHl7Message } from "./make-hl7-message";

/**
 * Test fixture to suppress console logs during test execution
 */
function silenceLogs(testFn: () => void): () => void {
  return () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Suppress console output
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    try {
      return testFn();
    } finally {
      // Restore original console methods
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };
}

const PST_DATETIME = "20250102090000";
const EST_DATETIME = "20250102120000";
const UTC_DATETIME = "20250102170000";

describe("utcifyHl7Message", () => {
  describe("common test cases", () => {
    it("should convert PST to UTC", () => {
      const message = makeHl7Message({
        mshSendingApp: "LosAngelesHie",
        evnRecordedDatetime: PST_DATETIME,
      });

      const result = utcifyHl7Message(message);
      const evnSegment = result.getSegment("EVN");
      const recordedDatetime = evnSegment?.getComponent(2, 1);

      expect(recordedDatetime).toBe(UTC_DATETIME);
    });

    it("should convert EST to UTC", () => {
      const message = makeHl7Message({
        mshSendingApp: "NewYorkHie",
        evnRecordedDatetime: EST_DATETIME,
      });

      const result = utcifyHl7Message(message);
      const evnSegment = result.getSegment("EVN");
      const recordedDatetime = evnSegment?.getComponent(2, 1);

      expect(recordedDatetime).toBe(UTC_DATETIME);
    });

    it("should fallback to UTC if the partner is unknown", () => {
      const message = makeHl7Message({
        mshSendingApp: "UnknownPartner",
        evnRecordedDatetime: UTC_DATETIME,
      });

      const result = utcifyHl7Message(message);
      const evnSegment = result.getSegment("EVN");
      const recordedDatetime = evnSegment?.getComponent(2, 1);

      expect(recordedDatetime).toBe(UTC_DATETIME);
    });

    it("should not fail on empty field", () => {
      const message = makeHl7Message({
        mshSendingApp: "NewYorkHie",
        evnRecordedDatetime: "", // Empty datetime
      });

      const result = utcifyHl7Message(message);
      const evnSegment = result.getSegment("EVN");
      const recordedDatetime = evnSegment?.getComponent(2, 1);

      expect(recordedDatetime).toBe("");
    });
  });

  describe("MSH conversion", () => {
    it("should convert EST to UTC for datetime of message", () => {
      const message = makeHl7Message({
        mshSendingApp: "NewYorkHie", // EST timezone
        mshDatetimeOfMessage: EST_DATETIME,
      });

      const result = utcifyHl7Message(message);
      const mshSegment = result.getSegment("MSH");
      const datetimeOfMessage = mshSegment?.getComponent(7, 1);

      expect(datetimeOfMessage).toBe(UTC_DATETIME);
    });
  });

  describe("DG1 conversion", () => {
    it("should convert EST to UTC for diagnosis datetime", () => {
      const message = makeHl7Message({
        mshSendingApp: "NewYorkHie", // EST timezone
        dg1DiagnosisDatetime: EST_DATETIME,
      });

      const result = utcifyHl7Message(message);
      const dg1Segment = result.getSegment("DG1");
      const diagnosisDatetime = dg1Segment?.getComponent(5, 1);

      expect(diagnosisDatetime).toBe(UTC_DATETIME);
    });

    it("should convert all DG1 segments correctly", () => {
      const message = makeHl7Message({
        mshSendingApp: "NewYorkHie",
        dg1DiagnosisDatetime: EST_DATETIME,
      });

      const result = utcifyHl7Message(message);

      const dg1Segments = result.segments.filter(segment => segment.name === "DG1");

      dg1Segments.forEach((dg1Segment, index) => {
        const diagnosisDatetime = dg1Segment.getComponent(5, 1);
        expect(diagnosisDatetime).toBe(UTC_DATETIME);

        // Also verify the Set ID is correct (1, 2, 3)
        const setId = dg1Segment.getComponent(1, 1);
        expect(setId).toBe((index + 1).toString());
      });
    });
  });

  describe("PV1 conversion", () => {
    it("should convert both admit and discharge datetimes", () => {
      const message = makeHl7Message({
        mshSendingApp: "NewYorkHie", // EST timezone
        pv1AdmitDatetime: EST_DATETIME,
        pv1DischargeDatetime: EST_DATETIME,
      });

      const result = utcifyHl7Message(message);
      const pv1Segment = result.getSegment("PV1");
      const admitDatetime = pv1Segment?.getComponent(44, 1);
      const dischargeDatetime = pv1Segment?.getComponent(45, 1);

      expect(admitDatetime).toBe(UTC_DATETIME);
      expect(dischargeDatetime).toBe(UTC_DATETIME);
    });
  });

  describe("Edge cases", () => {
    it("should handle message with only empty datetime fields", () => {
      const message = makeHl7Message({
        mshSendingApp: "NewYorkHie",
        evnRecordedDatetime: "",
        dg1DiagnosisDatetime: "",
        pv1AdmitDatetime: "",
        pv1DischargeDatetime: "",
      });

      const result = utcifyHl7Message(message);

      // Should not throw and should return the same message structure
      expect(result.segments.length).toBe(message.segments.length);
    });

    it("should preserve other segments and fields unchanged", () => {
      const originalMessage = makeHl7Message({
        mshSendingApp: "NewYorkHie",
        evnRecordedDatetime: PST_DATETIME,
        dg1DiagnosisDatetime: PST_DATETIME,
        pv1AdmitDatetime: PST_DATETIME,
        pv1DischargeDatetime: PST_DATETIME,
      });

      const result = utcifyHl7Message(originalMessage);

      // Check that MSH segment is preserved
      const mshSegment = result.getSegment("MSH");
      expect(mshSegment?.getComponent(3, 1)).toBe("NewYorkHie");
      expect(mshSegment?.getComponent(9, 1)).toBe("ADT");
      expect(mshSegment?.getComponent(9, 2)).toBe("A01");

      // Check that PID segment is preserved
      const pidSegment = result.getSegment("PID");
      expect(pidSegment?.getComponent(3, 1)).toBe("12345");

      // Check that segments not being converted remain unchanged
      expect(result.segments.length).toBe(originalMessage.segments.length);
    });
  });
});

describe("HL7 datetime format parsing", () => {
  describe("datetime strings with timezone offsets", () => {
    it("should strip YYYYMMDDHHmm+HHMM format and add 00 to the end", () => {
      const message = makeHl7Message({
        mshSendingApp: "UnknownPartner", // Will use UTC as fallback
        evnRecordedDatetime: "198908181126+0215", // Aug 18, 1989 11:26 +02:15
      });

      const result = utcifyHl7Message(message);
      const evnSegment = result.getSegment("EVN");
      const recordedDatetime = evnSegment?.getComponent(2, 1);

      // Should convert to UTC: 11:26 +02:15 -> 09:11 UTC
      expect(recordedDatetime).toBe("19890818112600");
    });

    it("should strip YYYYMMDDHHmmss.S+HHMM format", () => {
      const message = makeHl7Message({
        mshSendingApp: "UnknownPartner",
        evnRecordedDatetime: "20210817151943.4+0200", // Aug 17, 2021 15:19:43.4 +02:00
      });

      const result = utcifyHl7Message(message);
      const evnSegment = result.getSegment("EVN");
      const recordedDatetime = evnSegment?.getComponent(2, 1);

      // Should convert to UTC: 15:19:43 +02:00 -> 13:19:43 UTC
      expect(recordedDatetime).toBe("20210817151943");
    });
  });

  describe("datetime strings without timezone", () => {
    it("should apply fallback timezone for YYYYMMDDHHmm format", () => {
      const message = makeHl7Message({
        mshSendingApp: "NewYorkHie", // EST timezone
        evnRecordedDatetime: "202501021200", // Jan 2, 2025 12:00
      });

      const result = utcifyHl7Message(message);
      const evnSegment = result.getSegment("EVN");
      const recordedDatetime = evnSegment?.getComponent(2, 1);

      // Should convert EST to UTC: 12:00 EST -> 17:00 UTC
      expect(recordedDatetime).toBe("20250102170000");
    });

    it("should handle YYYYMMDDHHmmss.S format", () => {
      const message = makeHl7Message({
        mshSendingApp: "LosAngelesHie", // PST timezone
        evnRecordedDatetime: "20250102120000.5", // Jan 2, 2025 12:00:00.5
      });

      const result = utcifyHl7Message(message);
      const evnSegment = result.getSegment("EVN");
      const recordedDatetime = evnSegment?.getComponent(2, 1);

      // Should convert PST to UTC: 12:00 PST -> 20:00 UTC
      expect(recordedDatetime).toBe("20250102200000");
    });
  });

  describe("edge cases", () => {
    it(
      "should handle invalid datetime gracefully",
      silenceLogs(() => {
        const message = makeHl7Message({
          mshSendingApp: "UnknownPartner",
          evnRecordedDatetime: "invalid-datetime",
        });

        const result = utcifyHl7Message(message);
        const evnSegment = result.getSegment("EVN");
        const recordedDatetime = evnSegment?.getComponent(2, 1);

        // Should return original value if parsing fails
        expect(recordedDatetime).toBe("invalid-datetime");
      })
    );

    it("should not modify datetime that's already UTC without timezone info", () => {
      const message = makeHl7Message({
        mshSendingApp: "UnknownPartner", // UTC fallback
        evnRecordedDatetime: "20250102170000",
      });

      const result = utcifyHl7Message(message);
      const evnSegment = result.getSegment("EVN");
      const recordedDatetime = evnSegment?.getComponent(2, 1);

      // Should remain the same since it's already in the fallback timezone (UTC)
      expect(recordedDatetime).toBe("20250102170000");
    });
  });
});
