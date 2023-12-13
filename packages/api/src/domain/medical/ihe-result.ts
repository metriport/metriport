import { BaseResultDomain } from "../base-domain";

export interface IHEResult<Response> extends BaseResultDomain {
  data: Response;
}
