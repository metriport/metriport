export interface PatientReference {
  cxId: string;
  patientId: string;
}

export interface DocumentReference {
  bucket: string;
  key: string;
}

export interface PatientWithDocuments extends PatientReference {
  documents: DocumentReference[];
}

export interface ListPatientsInput {
  cxId: string;
}

export interface ListDocumentsPerPatientInput {
  cxId: string;
  patientId: string;
  bucketName?: string;
}

export interface DownloadPatientDocumentInput {
  cxId: string;
  patientId: string;
  documentId: string;
}

export interface UnstructuredDataItem {
  documentId: string;
  resourceId: string;
  unstructuredData: string;
}
