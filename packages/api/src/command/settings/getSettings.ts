import NotFoundError from "../../errors/not-found";
import { Settings } from "../../models/settings";

export const getSettings = async ({ id }: { id: string }): Promise<Settings | null> => {
  return Settings.findByPk(id);
};

export const getSettingsOrFail = async ({ id }: { id: string }): Promise<Settings> => {
  const settings = await getSettings({ id });
  if (!settings) throw new NotFoundError(`Could not find settings ${id}`);
  return settings;
};
