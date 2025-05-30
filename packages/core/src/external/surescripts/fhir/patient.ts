import { Patient } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";
import { convertDateToString } from "@metriport/shared/common/date";

export function parsePatient(detail: FlatFileDetail): Patient {
  return {
    resourceType: "Patient",
    id: detail.patientId,
    name: [
      {
        given: [detail.patientFirstName],
        family: detail.patientLastName,
      },
    ],
    birthDate: convertDateToString(detail.patientDOB, { separator: "-" }),

    // gender: detail.patientGender,
  };
}
