import { faker } from "@faker-js/faker";
import { makePatientData } from "@metriport/core/domain/__tests__/patient";
import { PatientCreateCmd } from "../../../command/medical/patient/create-patient";
import { makeBaseDomain } from "../../__tests__/base-domain";

export function makePatientCreate(params: Partial<PatientCreateCmd> = {}): PatientCreateCmd {
  return {
    ...makeBaseDomain(),
    cxId: params.cxId ?? faker.string.uuid(),
    facilityId: params.facilityId ?? faker.string.uuid(),
    ...makePatientData(params),
  };
}
