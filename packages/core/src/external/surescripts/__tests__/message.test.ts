import { Config } from "../../../util/config";
import { toSurescriptsPatientLoadRow } from "../file-generator";
import {
  patientLoadDetailSchema,
  patientLoadDetailOrder,
  patientLoadFooterSchema,
  patientLoadFooterOrder,
} from "../schema/request";

const METRIPORT_OID = Config.getSystemRootOID();

// Note: These are test patients that do not actually exist.
describe("Patient load file testing", () => {
  it("should generate a simple patient row", () => {
    const patientId = "1a3c55d0-6681-4273-9524-2e1535c6b747";
    const expected = [
      "PNM",
      "1",
      METRIPORT_OID,
      patientId.replace(/-/g, ""),
      "Abingdon",
      "Perseus",
      "",
      "",
      "",
      "98 Bayview Ave",
      "",
      "New Rochelle",
      "NY",
      "10805",
      "20120901",
      "M",
      "1234567893",
      "",
      "",
      "",
    ].join("|");
    const testRow = toSurescriptsPatientLoadRow(
      {
        firstName: "Perseus",
        middleName: "",
        lastName: "Abingdon",
        suffix: "",
        recordType: "PNM",
        recordSequenceNumber: 1,
        assigningAuthority: METRIPORT_OID,
        patientId,
        addressLine1: "98 Bayview Ave",
        addressLine2: "",
        city: "New Rochelle",
        state: "NY",
        zip: "10805",
        dateOfBirth: "2012-09-01",
        genderAtBirth: "M",
        npiNumber: "1234567893",
      },
      patientLoadDetailSchema,
      patientLoadDetailOrder
    );

    expect(testRow.toString("ascii").trim()).toEqual(expected);
  });

  it("should generate a row with detailed demographics", () => {
    const patientId = "1a3c55d0-6681-4273-9524-2e1535c6b747";
    const expected = [
      "PNM",
      "1",
      METRIPORT_OID,
      patientId.replace(/-/g, ""),
      "Devereaux",
      "Margaret Adelia",
      "Beryl",
      "",
      "",
      "27-B Heald St",
      "",
      "Pepperell",
      "MA",
      "01463",
      "19971101",
      "F",
      "1234567890",
      "",
      "",
      "",
    ].join("|");

    const testRow = toSurescriptsPatientLoadRow(
      {
        firstName: "Margaret Adelia",
        middleName: "Beryl",
        lastName: "Devereaux",
        suffix: "",
        recordType: "PNM",
        recordSequenceNumber: 1,
        assigningAuthority: METRIPORT_OID,
        patientId,
        addressLine1: "27-B Heald St",
        addressLine2: "",
        city: "Pepperell",
        state: "MA",
        zip: "01463",
        dateOfBirth: "1997-11-01",
        genderAtBirth: "F",
        npiNumber: "1234567890",
      },
      patientLoadDetailSchema,
      patientLoadDetailOrder
    );

    expect(testRow.toString("ascii").trim()).toEqual(expected);
  });

  it("should generate a simple trailer row", () => {
    const trailerRow = toSurescriptsPatientLoadRow(
      {
        recordType: "TRL",
        totalRecords: 3,
      },
      patientLoadFooterSchema,
      patientLoadFooterOrder
    );
    const expected = ["TRL", "3"].join("|");

    expect(trailerRow.toString("ascii").trim()).toEqual(expected);
  });
});
