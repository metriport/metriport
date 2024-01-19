import { DocumentQueryResult as DocumentQueryResultCore } from "@metriport/core/src/external/carequality/ihe-result";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface DocumentQueryResult extends BaseDomainCreate, DocumentQueryResultCore {}
