import { Op } from "sequelize";
import NotFoundError from "../../errors/not-found";
import { ConnectedUser } from "../../models/connected-user";
import { ProviderOptions } from "../../shared/constants";
import { AtLeastOne } from "@metriport/shared";
import { capture } from "../../shared/notifications";

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

export const getAllConnectedUsers = async (cxId?: string): Promise<ConnectedUser[]> => {
  return ConnectedUser.findAll({
    where: {
      ...(cxId ? { cxId } : undefined),
    },
  });
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

// TODO 749: This function should be removed in this issue: https://github.com/metriport/metriport/issues/749
export const getConnectedUserByTokenOrFail = async (
  provider: string,
  str: string
): Promise<ConnectedUser> => {
  const connectedUser = await ConnectedUser.findAll({
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

  if (!connectedUser.length)
    throw new NotFoundError(`Could not find connected user with str matching token`);

  if (connectedUser.length > 1)
    capture.message(`Found multiple connected users with str matching token`, {
      extra: { context: `getConnectedUserByTokenOrFail`, connectedUser },
    });

  return connectedUser[0];
};

// TODO 749: See if this function can be improved for token matching within the scope of this issue: https://github.com/metriport/metriport/issues/749
export const getConnectedUsersByTokenOrFail = async (
  provider: string,
  token: string
): Promise<ConnectedUser[]> => {
  const connectedUsers = await ConnectedUser.findAll({
    where: {
      providerMap: {
        [provider]: {
          token: {
            // TODO: Find more optimal solution
            [Op.like]: "%" + token + "%",
          },
        },
      },
    },
  });

  if (!connectedUsers.length)
    throw new NotFoundError(`Could not find connected users with str matching token`);

  return connectedUsers;
};

export const getConnectedUsersByDeviceId = async (
  provider: string,
  device_id: string
): Promise<ConnectedUser[]> => {
  const connectedUsers = await ConnectedUser.findAll({
    where: {
      providerMap: {
        [provider]: {
          connectedDeviceIds: {
            [Op.match]: device_id,
          },
        },
      },
    },
  });

  if (!connectedUsers.length) {
    throw new NotFoundError(`Could not find connected users associated with a device ID`);
  }

  return connectedUsers;
};
