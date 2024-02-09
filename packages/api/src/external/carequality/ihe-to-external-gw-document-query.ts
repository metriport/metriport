import { IHEToExternalGwDocumentQuery as IHEToExternalGwDocumentQueryCore } from "@metriport/core/src/external/carequality/ihe-result";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface IHEToExternalGwDocumentQuery
  extends BaseDomainCreate,
    IHEToExternalGwDocumentQueryCore {}
