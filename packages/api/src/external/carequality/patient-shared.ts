import { PatientExternalDataEntry } from "../../domain/medical/patient";

export type CQExternalPatient = {
  patientId: string;
  systemId: string;
};

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(public patientLinks: CQExternalPatient[]) {
    super();
  }
}
