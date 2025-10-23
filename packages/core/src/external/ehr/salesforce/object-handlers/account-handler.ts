import { BaseSalesforceObjectHandler, SalesforcePatient, SalesforceObjectData } from ".";

/**
 * Handler for Salesforce Account objects (PersonAccount)
 * Note: PersonAccount is a special Account type that represents an individual,
 * combining Account and Contact features
 */
export class AccountHandler extends BaseSalesforceObjectHandler {
  private static readonly ACCOUNT_FIELDS = [
    "Id",
    "FirstName",
    "LastName",
    "PersonEmail",
    "Phone",
    "PersonMobilePhone",
    "PersonOtherPhone",
    "BillingStreet",
    "BillingCity",
    "BillingState",
    "BillingPostalCode",
    "BillingCountry",
    "Birth_Date__c",
    "GenderIdentity__c", // Custom field - adjust based on your Salesforce schema
  ] as const;

  getObjectType(): string {
    return "Account";
  }

  getSOQLFields(): readonly string[] {
    return AccountHandler.ACCOUNT_FIELDS;
  }

  normalizeData(rawData: SalesforceObjectData): SalesforcePatient {
    return {
      id: this.getString(rawData, "Id"),
      firstName: this.getStringOrNull(rawData, "FirstName"),
      lastName: this.getStringOrNull(rawData, "LastName"),
      mailingStreet: this.getStringOrNull(rawData, "BillingStreet"),
      mailingCity: this.getStringOrNull(rawData, "BillingCity"),
      mailingState: this.getStringOrNull(rawData, "BillingState"),
      mailingPostalCode: this.getStringOrNull(rawData, "BillingPostalCode"),
      mailingCountry: this.getStringOrNull(rawData, "BillingCountry"),
      phone: this.getStringOrNull(rawData, "Phone"),
      mobilePhone: this.getStringOrNull(rawData, "PersonMobilePhone"),
      otherPhone: this.getStringOrNull(rawData, "PersonOtherPhone"),
      email: this.getStringOrNull(rawData, "PersonEmail"),
      genderIdentity: this.getStringOrNull(rawData, "GenderIdentity__c"),
      birthdate: this.getStringOrNull(rawData, "Birth_Date__c"),
    };
  }

  private getString(data: SalesforceObjectData, field: string): string {
    const value = data[field];
    if (typeof value !== "string") {
      throw new Error(`Field ${field} is required but not found or not a string`);
    }
    return value;
  }

  private getStringOrNull(data: SalesforceObjectData, field: string): string | null {
    const value = data[field];
    if (value === null || value === undefined) {
      return null;
    }
    return typeof value === "string" ? value : null;
  }
}
