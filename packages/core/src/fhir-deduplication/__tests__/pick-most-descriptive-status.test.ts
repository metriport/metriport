import { MedicationStatementStatus, statusRanking } from "../resources/medication-statement";
import { pickMostDescriptiveStatus } from "../shared";

describe("pickMostDescriptiveStatus", () => {
  it("correctly picks the more descriptive status", () => {
    let status1: MedicationStatementStatus = "unknown";
    let status2: MedicationStatementStatus = "stopped";
    expect(pickMostDescriptiveStatus(statusRanking, status1, status2)).toEqual("stopped");

    status1 = "stopped";
    status2 = "unknown";
    expect(pickMostDescriptiveStatus(statusRanking, status1, status2)).toEqual("stopped");

    status1 = "active";
    status2 = "stopped";
    expect(pickMostDescriptiveStatus(statusRanking, status1, status2)).toEqual("stopped");

    status1 = "active";
    status2 = "completed";
    expect(pickMostDescriptiveStatus(statusRanking, status1, status2)).toEqual("completed");

    status1 = "intended";
    status2 = "active";
    expect(pickMostDescriptiveStatus(statusRanking, status1, status2)).toEqual("active");
  });
});
