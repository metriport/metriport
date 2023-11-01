import { DocRequest, DocRequestMetadata } from "../../../domain/medical/doc-request";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getDocRequestOrFail } from "./get-doc-request";

export type DocRequestUpdateCmd = BaseUpdateCmdWithCustomer & { metadata: DocRequestMetadata };

export const updateDocRequest = async (requestUpdate: DocRequestUpdateCmd): Promise<DocRequest> => {
  const { id, cxId, eTag, metadata } = requestUpdate;

  const request = await getDocRequestOrFail({ id, cxId });
  validateVersionForUpdate(request, eTag);

  return request.update({ metadata });
};
