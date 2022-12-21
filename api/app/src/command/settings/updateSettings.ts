import { Settings } from "../../models/settings";
import { getSettingsOrFail } from "./getSettings";

export interface UpdateSettingsCommand {
  id: string;
  webhookUrl: string | null;
}

export const updateSettings = async ({
  id,
  webhookUrl,
}: UpdateSettingsCommand): Promise<Settings> => {
  await Settings.update({ webhookUrl }, { where: { id } });
  return getSettingsOrFail({ id });
};
