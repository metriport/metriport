import { NetworkLink } from "@metriport/commonwell-sdk-v1";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import { CwLinkV1, isCwLinkV2 } from "../commonwell/patient/cw-patient-data/shared";

export type CwLink = NetworkLink;

export type CwData = {
  links: CwLink[];
  linkDemographicsHistory?: LinkDemographicsHistory;
};

export function filterCwLinkV1(link: CwLink): CwLinkV1 | [] {
  if (isCwLinkV2(link)) return [];
  return link;
}
