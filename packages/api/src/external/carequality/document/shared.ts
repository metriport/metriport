import { DocumentReference } from "@metriport/ihe-gateway-sdk";

export type DocumentWithMetriportId = DocumentReference & {
  id: string;
  originalId: string;
};
