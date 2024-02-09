import { IHEToExternalGwDocumentRetrieval as IHEToExternalGwDocumentRetrievalCore } from "@metriport/core/src/external/carequality/ihe-result";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface IHEToExternalGwDocumentRetrieval
  extends BaseDomainCreate,
    IHEToExternalGwDocumentRetrievalCore {}
