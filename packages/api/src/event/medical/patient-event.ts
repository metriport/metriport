import EventEmitter from "events";
import { Patient } from "../../domain/medical/patient";

export type PatientEvent = Pick<Patient, "id" | "cxId">;

let patientEventsInstance: PatientEvents;

export const patientEvents = (): PatientEvents => {
  if (!patientEventsInstance) {
    patientEventsInstance = new PatientEvents();
  }
  return patientEventsInstance;
};

export class PatientEvents extends EventEmitter {
  static readonly CREATED = "patient-created";
  static readonly UPDATED = "patient-updated";
  static readonly DELETED = "patient-deleted";

  emitCreated(patient: PatientEvent) {
    this.emit(PatientEvents.CREATED, { id: patient.id, cxId: patient.cxId });
  }

  emitUpdated(patient: PatientEvent) {
    this.emit(PatientEvents.UPDATED, { id: patient.id, cxId: patient.cxId });
  }

  emitDeleted(patient: PatientEvent) {
    this.emit(PatientEvents.DELETED, { id: patient.id, cxId: patient.cxId });
  }
}
