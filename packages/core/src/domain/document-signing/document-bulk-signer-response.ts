import { DocumentReference } from "@metriport/api-sdk/medical/models/document";

export type DocumentFromBulkSignerLambda = DocumentReference & { url: string };
