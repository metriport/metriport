import { Settings } from "../../models/settings";

export interface CreateSettingsCommand {
  id: string;
}

export const createSettings = async ({ id }: CreateSettingsCommand): Promise<Settings> => {
  const settings = await Settings.create({
    id,
    webhookEnabled: false,
  });
  return settings;
};
