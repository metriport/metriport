import { PatientResponseItem } from "@metriport/commonwell-sdk";
import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";

export type CwLink = CwLinkV1 | CwLinkV2;

export type CwData = {
  links: CwLink[];
  linkDemographicsHistory?: LinkDemographicsHistory;
};

export interface CwPatientDataCreate extends BaseDomainCreate {
  cxId: string;
  data: CwData;
}

export interface CwPatientDataCreatePartial extends BaseDomainCreate {
  cxId: string;
  data: Partial<CwData>;
}

export interface CwPatientData extends BaseDomain, CwPatientDataCreate {}

export type CwLinkV2 = PatientResponseItem & {
  version: 2;
};

export type CwLinkV1 = LocalNetworkLink & {
  version?: never;
};

export function isCwLinkV1(link: CwLink): link is CwLinkV1 {
  return !("version" in link);
}
export function isCwLinkV2(link: CwLink): link is CwLinkV2 {
  return "version" in link && link.version === 2;
}

/**
 * Local type definition for the legacy platform's NetworkLink that doesn't rely on external types.
 * This represents the structure of a CommonWell network link.
 * Needed for backwards compatibility with existing data in the DB.
 */
export type LocalNetworkLink = {
  _links?: {
    self?: {
      type?: string | null;
      href?: string | null;
      templated?: boolean | null;
    } | null;
    upgrade?: {
      type?: string | null;
      href?: string | null;
      templated?: boolean | null;
    } | null;
    downgrade?: {
      type?: string | null;
      href?: string | null;
      templated?: boolean | null;
    } | null;
  } | null;
  assuranceLevel?: string | null;
  patient?: {
    details: {
      name: {
        family: string[];
        use?: string | null;
        period?: {
          start?: string;
          end?: string;
        } | null;
        text?: string | null;
        given?: string[];
        prefix?: string | string[] | null;
        suffix?: string | string[] | null;
      }[];
      gender: {
        code: string;
        system?: string | null;
        display?: string | null;
      };
      birthDate: string;
      address: {
        zip: string;
        use?: string | null;
        period?: {
          start?: string;
          end?: string;
        } | null;
        line?: string[] | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
      }[];
      identifier?:
        | {
            system: string;
            key: string;
            use?: "usual" | "official" | "temp" | "secondary" | "old" | "unspecified" | null;
            label?: string | null;
            period?: {
              start?: string;
              end?: string;
            } | null;
            assigner?: string | null;
          }[]
        | null;
      telecom?:
        | {
            value?: string | null;
            system?: string | null;
            use?: string | null;
            period?: {
              start?: string;
              end?: string;
            } | null;
          }[]
        | null;
      picture?: any;
    };
    identifier?:
      | {
          system: string;
          key: string;
          use?: "usual" | "official" | "temp" | "secondary" | "old" | "unspecified" | null;
          label?: string | null;
          period?: {
            start?: string;
            end?: string;
          } | null;
          assigner?: string | null;
        }[]
      | null;
    provider?: {
      type?: string | null;
      display?: string | null;
      reference?: string | null;
    } | null;
  } | null;
};
