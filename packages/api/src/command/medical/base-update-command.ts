export type BaseUpdateCmd = {
  id: string;
  eTag?: string;
};

export type BaseUpdateCmdWithCustomer = BaseUpdateCmd & {
  cxId: string;
};
