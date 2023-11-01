import { Op, Transaction } from "sequelize";
import NotFoundError from "../../../errors/not-found";
import { DocRequestModel } from "../../../models/medical/doc-request";

export const getDocRequestIds = async ({
  facilityId,
  cxId,
}: {
  facilityId?: string;
  cxId: string;
}): Promise<string[]> => {
  const requests = await DocRequestModel.findAll({
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

export type GetDocRequest = {
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

export const getDocRequest = async ({
  id,
  cxId,
  transaction,
  lock,
}: GetDocRequest): Promise<DocRequestModel | undefined> => {
  const request = await DocRequestModel.findOne({
    where: { cxId, id },
    transaction,
    lock,
  });
  return request ?? undefined;
};

export const getDocRequestOrFail = async (params: GetDocRequest): Promise<DocRequestModel> => {
  const request = await getDocRequest(params);
  if (!request) throw new NotFoundError(`Could not find request`, undefined, { id: params.id });
  return request;
};
