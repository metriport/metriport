import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getRequestOrFail } from "./get-request";

export type RequestDeleteCmd = BaseUpdateCmdWithCustomer;

export type DeleteOptions = {
  allEnvs?: boolean;
};

export const deleteRequest = async (
  requestDelete: RequestDeleteCmd,
  options: DeleteOptions = {}
): Promise<void> => {
  const { id, cxId, eTag } = requestDelete;

  const request = await getRequestOrFail({ id, cxId });
  validateVersionForUpdate(request, eTag);

  if (options.allEnvs) {
    await request.destroy();
  }
};
