export type StoreECAfterIncludeListCmd = {
  ecId: string;
  cxId: string;
  patientIds: string[];
  cqOrgIds: string[];
};

export type StoreECAfterDocQueryCmd = {
  ecId: string;
  cxId: string;
  patientId: string;
  docsFound: number;
};

export abstract class ECUpdater {
  public abstract storeECAfterIncludeList(params: StoreECAfterIncludeListCmd): Promise<void>;
  public abstract storeECAfterDocQuery(params: StoreECAfterDocQueryCmd): Promise<void>;
}
