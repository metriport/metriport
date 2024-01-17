import { BaseDomain, BaseDomainCreate } from "./base-domain";

export interface SettingsCreate extends Omit<BaseDomainCreate, "id"> {
  webhookUrl: string;
  webhookKey: string;
  webhookEnabled: boolean;
  webhookStatusDetail: string;
}

export interface Settings extends BaseDomain, SettingsCreate {}
