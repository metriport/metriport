import { DocumentQueryProgress } from "../../domain/medical/document-query";
import { PatientExternalDataEntry } from "../../domain/medical/patient";

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(public documentQueryProgress?: DocumentQueryProgress) {
    super();
  }
}
