import {
  HieConfig,
  isHieEnabledForVpn,
  VpnlessHieConfig,
} from "@metriport/core/command/hl7v2-subscriptions/types";
import { HieConfigDictionary } from "@metriport/core/external/hl7-notification/hie-config-dictionary";

/**
 * Create a dictionary of metadata for HieConfigs, for use in identifying messages based on source tunnel.
 * @param hieConfigs HieConfigs from the environment config
 * @returns Dictionary of HieConfig objects
 */
export const createHieConfigDictionary = (
  hieConfigs: Record<string, HieConfig | VpnlessHieConfig>
) => {
  return Object.values(hieConfigs).reduce((acc, item) => {
    if (!isHieEnabledForVpn(item)) {
      return acc;
    }
    acc[item.name] = {
      cidrBlock: item.internalCidrBlock,
      timezone: item.timezone,
    };
    return acc;
  }, {} as HieConfigDictionary);
};
