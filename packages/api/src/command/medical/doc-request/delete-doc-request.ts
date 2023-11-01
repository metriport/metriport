import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getDocRequestOrFail } from "./get-doc-request";

export type DocRequestDeleteCmd = BaseUpdateCmdWithCustomer;

export type DeleteOptions = {
  allEnvs?: boolean;
};

export const deleteDocRequest = async (
  requestDelete: DocRequestDeleteCmd,
  options: DeleteOptions = {}
): Promise<void> => {
  const { id, cxId, eTag } = requestDelete;

  const request = await getDocRequestOrFail({ id, cxId });
  validateVersionForUpdate(request, eTag);

  if (options.allEnvs) {
    await request.destroy();
  }
};
