import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";

export const maxWebhookUrlLength = 2048;
export const maxWebhookStatusLength = 2048;

export interface MrFilters {
  key: string;
  dateFilter?: {
    from?: string;
    to?: string;
  };
  stringFilter?: string;
}

export interface SettingsCreate extends Omit<BaseDomainCreate, "id"> {
  webhookUrl: string;
  webhookKey: string;
  webhookEnabled: boolean;
  webhookStatusDetail: string;
  mrFilters?: MrFilters[];
}

export interface Settings extends BaseDomain, SettingsCreate {}
