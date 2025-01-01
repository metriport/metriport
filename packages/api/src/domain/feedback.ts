import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";

export type FeedbackData = {
  /** The content being evaluated/receiving feedback */
  content: string;
  /** The version of the content being evaluated */
  version?: string;
  /** Location of the original content being evaluated */
  location?: string;
};

export interface FeedbackCreate extends BaseDomainCreate {
  cxId: string;
  /**
   * The ID of the entity getting feedback.
   * In the case of a Patient's Medical Record (MR), this is the patient ID - since there can be
   * only a single MR per patient at any given time - and we don't have an entity to represent
   * the MR.
   */
  entityId: string;
  // TODO add the type of the entity if/when we decide to support multiple types of entities
  // entityType: string;
  data: FeedbackData;
}

/**
 * Represents something being evaluated/receiving feedback.
 *
 * In the case of a Patient's Medical Record (MR), each instance of this Feedback entity represents
 * a snapshot of the MR at a given point in time.
 */
export interface Feedback extends BaseDomain, FeedbackCreate {}

/**
 * Represents a single feedback for a given entity.
 *
 * In the case of a Patient's Medical Record (MR), each instance of this entity represents a single
 * feedback received about the Patient's MR.
 */
export interface FeedbackEntryCreate extends Omit<BaseDomainCreate, "id"> {
  feedbackId: string;
  comment: string;
  authorName: string | undefined;
}

export interface FeedbackEntry extends BaseDomain, FeedbackEntryCreate {}
