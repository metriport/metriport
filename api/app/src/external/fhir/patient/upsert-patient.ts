import { Patient } from "@medplum/fhirtypes";
import { api } from "../api";
import { capture } from "../../../shared/notifications";

export const upsertPatientToFHIRServer = async (patient: Patient) => {
  try {
    await api.updateResource(patient);
  } catch (err) {
    capture.error(err, {
      extra: { context: `fhir.add.patient` },
    });
  }
};
