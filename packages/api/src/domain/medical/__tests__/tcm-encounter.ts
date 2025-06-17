import { faker } from "@faker-js/faker";
import { TcmEncounter } from "../tcm-encounter";

export const makeTcmEncounter = (params?: Partial<TcmEncounter>): TcmEncounter => {
  return {
    id: params?.id ?? faker.string.uuid(),
    cxId: params?.cxId ?? faker.string.uuid(),
    patientId: params?.patientId ?? faker.string.uuid(),
    facilityName: params?.facilityName ?? faker.company.name(),
    latestEvent: params?.latestEvent ?? "Admitted",
    class: params?.class ?? "Inpatient",
    admitTime: params?.admitTime ?? faker.date.recent(),
    dischargeTime: params?.dischargeTime ?? null,
    clinicalInformation: params?.clinicalInformation ?? {},
    createdAt: params?.createdAt ?? faker.date.recent(),
    updatedAt: params?.updatedAt ?? faker.date.recent(),
    eTag: params?.eTag ?? faker.string.uuid(),
  };
};
