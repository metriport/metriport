import { DocumentQueryResult as DocumentQueryResultCore } from "@metriport/core/src/external/carequality/document-query-result";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface DocumentQueryResult extends BaseDomainCreate, DocumentQueryResultCore {}
