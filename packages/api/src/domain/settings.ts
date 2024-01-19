import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface SettingsCreate extends Omit<BaseDomainCreate, "id"> {
  webhookUrl: string;
  webhookKey: string;
  webhookEnabled: boolean;
  webhookStatusDetail: string;
}

export interface Settings extends BaseDomain, SettingsCreate {}
