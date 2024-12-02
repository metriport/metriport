import { BaseDomain } from "@metriport/core/domain/base-domain";
import { clientKeySchema } from "@metriport/shared";
import {
  ElationData,
  elationDataSchema,
} from "@metriport/shared/interface/external/elation/client-key-mapping";
import { z } from "zod";
import { EhrSources } from "../external/ehr/shared";

export type ClientKeySources = ClientKeyMappingPerSource["source"];
export type ClientKeyData = ClientKeyMappingPerSource["data"];

export const clientKeyMappingsSourceMap: Map<ClientKeySources, { bodyParser: z.Schema }> = new Map([
  [
    EhrSources.elation,
    { bodyParser: z.object({ keys: clientKeySchema, data: elationDataSchema }) },
  ],
]);

export type ClientKeyMappingPerSource = {
  externalId: string;
  cxId: string;
  clientKey: string;
  clientSecret: string;
} & {
  source: EhrSources.elation;
  data: ElationData | null;
};

export interface ClientKeyMapping extends BaseDomain, ClientKeyMappingPerSource {}
