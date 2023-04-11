export interface BaseDomainCreate {
  id: string;
}

export interface BaseDomain extends BaseDomainCreate {
  createdAt: Date;
  updatedAt: Date;
  eTag: string;
}
