import { Op } from "sequelize";
import NotFoundError from "../../errors/not-found";
import { ConnectedUser } from "../../models/connected-user";
import { ProviderOptions } from "../../shared/constants";
import { AtLeastOne } from "../../shared/types";

export const getConnectedUser = async ({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<ConnectedUser | null> => {
  return ConnectedUser.findOne({
    where: { id, cxId },
  });
};

export const getConnectedUserOrFail = async ({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<ConnectedUser> => {
  const connectedUser = await getConnectedUser({ id, cxId });
  if (!connectedUser)
    throw new NotFoundError(`Could not find connected user ${id} for customer ${cxId}`);
  return connectedUser;
};

export const getProviderTokenFromConnectedUserOrFail = (
  connectedUser: ConnectedUser,
  provider: ProviderOptions
) => {
  if (!connectedUser.providerMap) throw new NotFoundError("Could not find provider map");

  const token = connectedUser.providerMap[provider]?.token;
  if (token) return token;

  throw new NotFoundError(`Could not find connect token for ${provider}`);
};

export const getConnectedUsers = async ({
  ids,
  cxId,
}: AtLeastOne<Pick<ConnectedUser, "cxId"> & { ids: ConnectedUser["id"][] }>): Promise<
  ConnectedUser[]
> => {
  return ConnectedUser.findAll({
    where: {
      ...(ids ? { id: ids } : undefined),
      cxId,
    },
  });
};

export const getAllConnectedUsers = async (cxId?: string): Promise<ConnectedUser[]> => {
  return ConnectedUser.findAll({
    where: {
      ...(cxId ? { cxId } : undefined),
    },
  });
};

export const getConnectedUserByTokenOrFail = async (
  provider: string,
  str: string
): Promise<ConnectedUser> => {
  const connectedUser = await ConnectedUser.findOne({
    where: {
      providerMap: {
        [provider]: {
          token: {
            // TODO: Find more optimal solution
            [Op.like]: "%" + str + "%",
          },
        },
      },
    },
  });

  if (!connectedUser)
    throw new NotFoundError(`Could not find connected user with str matching token`);

  return connectedUser;
};
