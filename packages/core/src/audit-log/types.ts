export type TransactionType = "ITI-55" | "ITI-38" | "ITI-39";

export const UNDEFINED_HTTP_STATUS_CODE = 501; // Not Implemented

export enum NetworkAccessPointTypeCode {
  DnsName = "1", // AKA Machine name
  IpAddress = "2",
  Uri = "5",
}

export type NetworkAccessPoint = {
  type: NetworkAccessPointTypeCode;
  address: string;
};

export enum Source {
  HIE_CQ = "carequality",
  HIE_CW = "commonwell",
  HIE_EHEX = "ehealthexchange",
  QHIN = "qhin",
  SURESCRIPTS = "surescripts",
  QUEST = "quest",
  EHR_ATHENA = "athena",
  EHR_CANVAS = "canvas",
  EHR_ELATION = "elation",
  EHR_HEALTHIE = "healthie",
  EHR_ECLINICALWORKS = "eclinicalworks",
  EHR_SALESFORCE = "salesforce",
}

/**
 * FHIR AuditEvent action codes
 * @see https://www.hl7.org/fhir/valueset-audit-event-action.html
 */
export enum AuditEventAction {
  /** Create - Create a new object */
  Create = "C",
  /** Read - Display or print information */
  Read = "R",
  /** Update - Update an existing object */
  Update = "U",
  /** Delete - Delete an existing object */
  Delete = "D",
  /** Execute - Perform a system or application function */
  Execute = "E",
}

/**
 * FHIR AuditEvent outcome codes
 * @see https://www.hl7.org/fhir/valueset-audit-event-outcome.html
 */
export enum AuditEventOutcome {
  /** Success - The operation completed successfully */
  Success = "0",
  /** MinorFailure - The action was not successful due to some minor error */
  MinorFailure = "4",
  /** SeriousFailure - The action was not successful due to some serious error */
  SeriousFailure = "8",
  /** MajorFailure - The action was not successful due to some major error */
  MajorFailure = "12",
}
