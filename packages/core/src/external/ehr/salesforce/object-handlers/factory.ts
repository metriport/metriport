import { MetriportError } from "@metriport/shared";
import { AccountHandler, ContactHandler, SalesforceObjectHandler } from ".";

export type SalesforceObjectType = "contact" | "account";

const handlerRegistry: Record<SalesforceObjectType, SalesforceObjectHandler> = {
  contact: new ContactHandler(),
  account: new AccountHandler(),
};

/**
 * Factory function to get the appropriate handler for a Salesforce object type
 */
export function getObjectHandler(objectType: SalesforceObjectType): SalesforceObjectHandler {
  const handler = handlerRegistry[objectType];
  if (!handler) {
    throw new MetriportError("Unsupported Salesforce object type", undefined, { objectType });
  }
  return handler;
}

/**
 * Parse patient ID and return object type and ID
 * Format: "contact_XXXXX" or "account_XXXXX"
 */
export function parsePatientId(patientId: string): {
  objectType: SalesforceObjectType;
  id: string;
} {
  const [type, id] = patientId.split("_");
  const objectType = type?.toLowerCase();

  if (!objectType || !["contact", "account"].includes(objectType)) {
    throw new MetriportError("Invalid patient ID prefix", undefined, { patientId });
  }

  // Salesforce IDs are 15 or 18 alphanumeric characters
  const isValidId = typeof id === "string" && /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(id);

  if (!isValidId) {
    throw new MetriportError("Invalid Salesforce ID format", undefined, { patientId });
  }

  return {
    objectType: objectType as SalesforceObjectType,
    id,
  };
}
