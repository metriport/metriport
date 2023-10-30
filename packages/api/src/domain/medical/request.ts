import { BaseDomain, BaseDomainCreate } from "../../domain/base-domain";

// TODO Can have x bytes. Dont allow for anything to get in.
export type RequestData = {
  data: { [key: string]: string }; // dictionary with properties of type string.
};

// TODO move this to the domain folder
export interface RequestCreate extends BaseDomainCreate {
  cxId: string;
  patientId: string;
  facilityIds: string[];
  data: RequestData;
}

export interface Request extends BaseDomain, RequestCreate {}
