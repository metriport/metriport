/**
 * Represents raw data from Salesforce before normalization
 */
export type SalesforceObjectData = Record<string, unknown>;

/**
 * Normalized patient data from any Salesforce object type
 */
export type SalesforcePatient = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  mailingStreet: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingPostalCode: string | null;
  mailingCountry: string | null;
  phone: string | null;
  mobilePhone: string | null;
  otherPhone: string | null;
  email: string | null;
  genderIdentity: string | null;
  birthdate: string | null;
};

/**
 * Defines the contract for handling different Salesforce object types
 */
export interface SalesforceObjectHandler {
  /**
   * Get the Salesforce object type name (e.g., "Contact", "Account")
   */
  getObjectType(): string;

  /**
   * Get the SOQL fields to query for this object type
   */
  getSOQLFields(): readonly string[];

  /**
   * Transform raw Salesforce data into normalized format
   */
  normalizeData(rawData: SalesforceObjectData): SalesforcePatient;
}

/**
 * Base implementation with common validation logic
 */
export abstract class BaseSalesforceObjectHandler implements SalesforceObjectHandler {
  abstract getObjectType(): string;
  abstract getSOQLFields(): readonly string[];
  abstract normalizeData(rawData: SalesforceObjectData): SalesforcePatient;
}
