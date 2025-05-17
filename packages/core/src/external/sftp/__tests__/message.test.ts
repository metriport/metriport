import { generateSurescriptsRow } from "../surescripts/message";
import {
  patientLoadDetailSchema,
  patientLoadDetailOrder,
  patientLoadFooterSchema,
  patientLoadFooterOrder,
} from "../surescripts/schema/load";

import { METRIPORT_OID } from "../surescripts/constants";

describe("Patient load file testing", () => {
  it("should generate a simple patient row", () => {
    const patientId = "1a3c55d0-6681-4273-9524-2e1535c6b747";

    expect(
      Buffer.compare(
        generateSurescriptsRow(
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
            dateOfBirth: "20120901",
            genderAtBirth: "M",
            npiNumber: "1234567890",
            startDate: new Date("2024-10-01"),
            endDate: new Date("2025-05-01"),
            requestedNotifications: ["PMANewRx", "PMAInfo"],
          },
          patientLoadDetailSchema,
          patientLoadDetailOrder
        ),
        Buffer.from(
          `PNM|1|${METRIPORT_OID}|${patientId}|Abingdon|Perseus||||98 Bayview Ave||New Rochelle|NY|10805|20120901|M|1234567893|||`,
          "ascii"
        )
      )
    ).toEqual(0);
  });

  it("should generate a row with detailed demographics", () => {
    const patientId = "1a3c55d0-6681-4273-9524-2e1535c6b747";
    const outputRow = `PNM|1|${METRIPORT_OID}|${patientId}|Devereaux|Margaret Adelia|Beryl|||27-B Heald St||Pepperell|MA|01463|19971101|F|1234567893|||`;

    expect(
      Buffer.compare(
        generateSurescriptsRow(
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
            dateOfBirth: "20120901",
            genderAtBirth: "M",
            npiNumber: "1234567890",
            startDate: new Date("2024-10-01"),
            endDate: new Date("2025-05-01"),
            requestedNotifications: ["PMANewRx", "PMAInfo"],
          },
          patientLoadDetailSchema,
          patientLoadDetailOrder
        ),
        Buffer.from(outputRow, "ascii")
      )
    ).toEqual(0);
  });

  it("should generate a simple trailer row", () => {
    expect(
      Buffer.compare(
        generateSurescriptsRow(
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
