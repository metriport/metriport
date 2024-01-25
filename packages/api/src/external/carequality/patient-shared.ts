import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { PatientExternalDataEntry } from "@metriport/core/domain/patient";

export class PatientDataCarequality extends PatientExternalDataEntry {
  constructor(public documentQueryProgress?: DocumentQueryProgress) {
    super();
  }
}
