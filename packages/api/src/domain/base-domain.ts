export interface BaseDomainCreate {
  id: string;
}

export interface BaseDomain extends BaseDomainCreate {
  createdAt: Date;
  updatedAt: Date;
  eTag: string;
}

export interface BaseDomainSoftDelete extends BaseDomain {
  deletedAt?: Date;
}

export interface BaseResultDomain extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
}
