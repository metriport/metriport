import { ConnectedUser } from "../../models/connected-user";

export const deleteConnectedUser = async ({ id }: { id: string }): Promise<void> => {
  await ConnectedUser.destroy({ where: { id } });
};
