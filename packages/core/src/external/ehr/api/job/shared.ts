import { ApiBaseParams } from "../api-shared";

export type JobBaseParams = Pick<ApiBaseParams, "cxId"> & {
  jobId: string;
};
