import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { HieConfigDictionary } from "@metriport/core/external/hl7-notification/hie-config-dictionary";

export const createHieConfigDictionary = (hieConfigs: Record<string, HieConfig>) => {
  return Object.values(hieConfigs).reduce((acc, item) => {
    acc[item.name] = {
      cidrBlock: item.internalCidrBlock,
      timezone: item.timezone,
    };
    return acc;
  }, {} as HieConfigDictionary);
};
