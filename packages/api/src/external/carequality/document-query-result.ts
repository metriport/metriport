import { DocumentQueryResult as DocumentQueryResultCore } from "@metriport/core/src/external/carequality/ihe-result";
import { BaseDomainCreate } from "../../domain/base-domain";

export interface DocumentQueryResult extends BaseDomainCreate, DocumentQueryResultCore {}
