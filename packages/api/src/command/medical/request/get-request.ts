import { Op, Transaction } from "sequelize";
import NotFoundError from "../../../errors/not-found";
import { RequestModel } from "../../../models/medical/request";

export const getrequestIds = async ({
  facilityId,
  cxId,
}: {
  facilityId?: string;
  cxId: string;
}): Promise<string[]> => {
  const requests = await RequestModel.findAll({
    attributes: ["id"],
    where: {
      cxId,
      ...(facilityId
        ? {
            facilityIds: {
              [Op.contains]: [facilityId],
            },
          }
        : undefined),
    },
  });
  return requests.map(p => p.id);
};

export type GetRequest = {
  id: string;
  cxId: string;
} & (
  | {
      transaction?: never;
      lock?: never;
    }
  | {
      transaction: Transaction;
      lock?: boolean;
    }
);

export const getRequest = async ({
  id,
  cxId,
  transaction,
  lock,
}: GetRequest): Promise<RequestModel | undefined> => {
  const request = await RequestModel.findOne({
    where: { cxId, id },
    transaction,
    lock,
  });
  return request ?? undefined;
};

export const getRequestOrFail = async (params: GetRequest): Promise<RequestModel> => {
  const request = await getRequest(params);
  if (!request) throw new NotFoundError(`Could not find request`, undefined, { id: params.id });
  return request;
};
