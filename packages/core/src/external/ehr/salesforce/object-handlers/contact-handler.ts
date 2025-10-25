import { BaseSalesforceObjectHandler, SalesforcePatient, SalesforceObjectData } from ".";

/**
 * Handler for Salesforce Contact objects
 */
export class ContactHandler extends BaseSalesforceObjectHandler {
  private static readonly CONTACT_FIELDS = [
    "Id",
    "FirstName",
    "LastName",
    "Email",
    "Phone",
    "MobilePhone",
    "OtherPhone",
    "MailingStreet",
    "MailingCity",
    "MailingState",
    "MailingPostalCode",
    "MailingCountry",
    "Birthdate",
    "GenderIdentity",
  ] as const;

  getObjectType(): string {
    return "Contact";
  }

  getSOQLFields(): readonly string[] {
    return ContactHandler.CONTACT_FIELDS;
  }

  normalizeData(rawData: SalesforceObjectData): SalesforcePatient {
    return {
      id: this.getString(rawData, "Id"),
      firstName: this.getStringOrNull(rawData, "FirstName"),
      lastName: this.getStringOrNull(rawData, "LastName"),
      mailingStreet: this.getStringOrNull(rawData, "MailingStreet"),
      mailingCity: this.getStringOrNull(rawData, "MailingCity"),
      mailingState: this.getStringOrNull(rawData, "MailingState"),
      mailingPostalCode: this.getStringOrNull(rawData, "MailingPostalCode"),
      mailingCountry: this.getStringOrNull(rawData, "MailingCountry"),
      phone: this.getStringOrNull(rawData, "Phone"),
      mobilePhone: this.getStringOrNull(rawData, "MobilePhone"),
      otherPhone: this.getStringOrNull(rawData, "OtherPhone"),
      email: this.getStringOrNull(rawData, "Email"),
      genderIdentity: this.getStringOrNull(rawData, "GenderIdentity"),
      birthdate: this.getStringOrNull(rawData, "Birthdate"),
    };
  }
}
