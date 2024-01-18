export interface BaseDomainCreate {
  id: string;
}

export interface BaseDomainNoId {
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseDomain extends BaseDomainCreate, BaseDomainNoId {
  eTag: string;
}

export interface BaseDomainSoftDelete extends BaseDomain {
  deletedAt?: Date;
}
