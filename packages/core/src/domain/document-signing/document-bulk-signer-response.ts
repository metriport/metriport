import { DocumentReference } from "@medplum/fhirtypes";

export type DocumentFromBulkSignerLambda = DocumentReference & { url: string };
