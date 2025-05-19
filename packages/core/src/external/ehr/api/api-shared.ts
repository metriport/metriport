import { MetriportError } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { AxiosResponse } from "axios";

export type ApiBaseParams = {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
  patientId: string;
  departmentId?: string;
};

export function validateAndLogResponse(
  url: string,
  response: AxiosResponse,
  debug: typeof console.log
) {
  if (!response.data) throw new MetriportError(`No body returned from ${url}`);
  debug(`${url} resp: `, () => JSON.stringify(response.data));
}
