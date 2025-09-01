import { buildDayjs } from "@metriport/shared/common/date";
import { sample } from "lodash";
import { createTcmEncounter } from "./create-tcm-encounter";

export async function createSampleTcmEncounters(cxId: string, patientId: string) {
  const facilityNames = [
    "Riverside Regional Medical Center",
    "St. Catherine's General Hospital",
    "Pine Valley Medical Center",
    "Heritage Community Hospital",
    "Westfield Memorial Hospital",
  ];

  // Create 5 TCM encounters with specific dates and events
  const twentyDaysAgo = buildDayjs().subtract(20, "day");
  const tenDaysAgo = buildDayjs().subtract(10, "day");
  const fiveDaysAgo = buildDayjs().subtract(5, "day");
  const threeDaysAgo = buildDayjs().subtract(3, "day");
  const yesterday = buildDayjs().subtract(1, "day");

  const encounters = [
    {
      latestEvent: "Discharged" as const,
      admitTime: twentyDaysAgo,
      dischargeTime: twentyDaysAgo.add(22, "hour"),
      clinicalInformation: {},
    },
    {
      latestEvent: "Discharged" as const,
      admitTime: tenDaysAgo,
      dischargeTime: tenDaysAgo.add(35, "hour"),
      clinicalInformation: {},
    },
    { latestEvent: "Admitted" as const, admitTime: fiveDaysAgo, clinicalInformation: {} },
    { latestEvent: "Admitted" as const, admitTime: threeDaysAgo, clinicalInformation: {} },
    { latestEvent: "Admitted" as const, admitTime: yesterday, clinicalInformation: {} },
  ];

  await Promise.all(
    encounters.map(async enc => {
      return await createTcmEncounter({
        cxId,
        patientId,
        class: sample(["inpatient encounter", "ambulatory", "emergency", "short stay"]) ?? "",
        facilityName: sample(facilityNames) ?? "",
        latestEvent: enc.latestEvent,
        admitTime: enc.admitTime.toDate(),
        dischargeTime: enc.dischargeTime?.toDate(),
        clinicalInformation: enc.clinicalInformation,
        outreachStatus: "Not Started",
        freetextNote: `Sample freetext note for ${enc.latestEvent} encounter`,
      });
    })
  );
}
