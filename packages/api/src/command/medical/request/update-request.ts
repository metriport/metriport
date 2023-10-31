import { Request, RequestMetadata } from "../../../domain/medical/request";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getRequestOrFail } from "./get-request";

export type RequestUpdateCmd = BaseUpdateCmdWithCustomer & { metadata: RequestMetadata };

export const updateRequest = async (requestUpdate: RequestUpdateCmd): Promise<Request> => {
  const { id, cxId, eTag, metadata } = requestUpdate;

  const request = await getRequestOrFail({ id, cxId });
  validateVersionForUpdate(request, eTag);

  return request.update({ metadata });
};
