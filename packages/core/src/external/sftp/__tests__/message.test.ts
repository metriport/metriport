import { Config } from "../../../util/config";
import { toSurescriptsPatientLoadRow } from "../surescripts/message";
import {
  patientLoadDetailSchema,
  patientLoadDetailOrder,
  patientLoadFooterSchema,
  patientLoadFooterOrder,
} from "../surescripts/schema/load";

const METRIPORT_OID = Config.getSystemRootOID();

// Note: These are test patients that do not actually exist.
describe("Patient load file testing", () => {
  it("should generate a simple patient row", () => {
    const patientId = "1a3c55d0-6681-4273-9524-2e1535c6b747";
    const expected = `PNM|1|${METRIPORT_OID}|${patientId}|Abingdon|Perseus||||98 Bayview Ave||New Rochelle|NY|10805|20120901|M|1234567893|||`;
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
        // requestedNotifications: ["PMANewRx", "PMAInfo"],
      },
      patientLoadDetailSchema,
      patientLoadDetailOrder
    );

    expect(Buffer.compare(testRow, Buffer.from(expected, "ascii"))).toEqual(0);
  });

  it("should generate a row with detailed demographics", () => {
    const patientId = "1a3c55d0-6681-4273-9524-2e1535c6b747";
    const outputRow = `PNM|1|${METRIPORT_OID}|${patientId}|Devereaux|Margaret Adelia|Beryl|||27-B Heald St||Pepperell|MA|01463|19971101|F|1234567890|||`;

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

    expect(Buffer.compare(testRow, Buffer.from(outputRow, "ascii"))).toEqual(0);
  });

  it("should generate a simple trailer row", () => {
    expect(
      Buffer.compare(
        toSurescriptsPatientLoadRow(
          {
            recordType: "TRL",
            totalRecords: 3,
          },
          patientLoadFooterSchema,
          patientLoadFooterOrder
        ),
        Buffer.from("TRL|3", "ascii")
      )
    ).toEqual(0);
  });
});
