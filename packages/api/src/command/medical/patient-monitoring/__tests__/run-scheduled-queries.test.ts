import { buildDayjs } from "@metriport/shared/common/date";
import { calculateCadencesForToday } from "../run-scheduled-queries";
import { PatientMonitoringCadence } from "@metriport/shared/domain/patient/patient-monitoring/utils";

describe("calculateCadencesForToday", () => {
  describe("first Saturday of the month", () => {
    it("should return weekly, biweekly, and monthly", () => {
      const firstSaturday = buildDayjs("2024-11-02"); // Nov 2, 2024 - 1st Saturday
      const result = calculateCadencesForToday(firstSaturday);
      expect(result).toEqual([
        PatientMonitoringCadence.WEEKLY,
        PatientMonitoringCadence.BIWEEKLY,
        PatientMonitoringCadence.MONTHLY,
      ]);
    });
  });

  describe("third Saturday of the month", () => {
    it("should return weekly and biweekly", () => {
      const thirdSaturday = buildDayjs("2024-11-16"); // Nov 16, 2024 - 3rd Saturday
      const result = calculateCadencesForToday(thirdSaturday);
      expect(result).toEqual([PatientMonitoringCadence.WEEKLY, PatientMonitoringCadence.BIWEEKLY]);
    });
  });

  describe("non-Saturday", () => {
    it("should fallback to weekly anyway", () => {
      const nonSaturday = buildDayjs("2024-11-24"); // Nov 24, 2024 - non-Saturday
      const result = calculateCadencesForToday(nonSaturday);
      expect(result).toEqual([PatientMonitoringCadence.WEEKLY]);
    });
  });
});
