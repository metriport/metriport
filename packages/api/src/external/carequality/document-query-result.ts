import { DocumentQueryResult as DocumentQueryResultCore } from "@metriport/core/src/external/carequality/domain/document-query-result";
import { BaseDomainCreate } from "../../domain/base-domain";

export interface DocumentQueryResult extends BaseDomainCreate, DocumentQueryResultCore {}
