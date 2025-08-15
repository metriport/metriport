import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { CQLink } from "../external/carequality/cq-patient-data";
import { CwLink } from "../external/commonwell/patient/cw-patient-data/shared";

export type InvalidLinksData = {
  carequality?: CQLink[];
  commonwell?: CwLink[];
};

export interface InvalidLinksCreate extends BaseDomainCreate {
  cxId: string;
  data: InvalidLinksData;
}

export interface InvalidLinks extends BaseDomain, InvalidLinksCreate {}
