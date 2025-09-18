import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { ResponsibleResource } from "@metriport/shared/domain/suspect";

export type ResponsibleResources = ResponsibleResource[] | null;

export interface SuspectCreate extends Omit<BaseDomainCreate, "id"> {
  cxId: string;
  patientId: string;
  suspectGroup: string;
  suspectIcd10Code: string;
  suspectIcd10ShortDescription: string;
  responsibleResources: ResponsibleResources;
  lastRun: Date;
}

export interface Suspect extends BaseDomain, SuspectCreate {}
