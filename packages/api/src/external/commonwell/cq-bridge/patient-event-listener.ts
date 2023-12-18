import { PatientEvents, patientEvents } from "../../../event/medical/patient-event";
import { setCQLinkStatus } from "./cq-link-status";

export default function () {
  patientEvents().on(PatientEvents.UPDATED, async patient => {
    const cqLinkStatus = "unlinked";
    console.log(`[CQ-BRIDGE] Setting cqLinkStatus of patient ${patient.id} to ${cqLinkStatus}`);
    await setCQLinkStatus({
      cxId: patient.cxId,
      patientId: patient.id,
      cqLinkStatus,
    });
  });
}
