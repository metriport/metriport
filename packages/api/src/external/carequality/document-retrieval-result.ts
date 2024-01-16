import { DocumentRetrievalResult as DocumentRetrievalResultCore } from "@metriport/core/src/external/carequality/ihe-result";
import { BaseDomainCreate } from "../../domain/base-domain";

export interface DocumentRetrievalResult extends BaseDomainCreate, DocumentRetrievalResultCore {}
