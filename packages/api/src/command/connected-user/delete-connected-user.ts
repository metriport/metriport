import { ConnectedUser } from "../../models/connected-user";

export const deleteConnectedUser = async (userId: string): Promise<void> => {
  await ConnectedUser.destroy({ where: { id: userId } });
};
