import { OperationOutcome } from "@metriport/commonwell-sdk";

type CWIssues = NonNullable<OperationOutcome["issue"]>;
type SincleCWIssues = CWIssues[number];

export type CWErrorGroup = Partial<Record<ErrorCategory, CWIssues>>;

export function groupCWErrors(errors: OperationOutcome[]): CWErrorGroup {
  const errorsByCategory: Partial<Record<ErrorCategory, CWIssues>> = {};

  function addToCategory(category: ErrorCategory, cwIssue: SincleCWIssues) {
    const errorsOfCategory = errorsByCategory[category];
    if (errorsOfCategory) errorsOfCategory.push(cwIssue);
    else errorsByCategory[category] = [cwIssue];
  }

  const issues = errors.flatMap(e => e.issue ?? []);
  issues.forEach(i => {
    const category = errorCategories.find(cat => (i.details?.text ?? "").includes(cat)) as
      | ErrorCategory
      | undefined;
    if (category) addToCategory(category, i);
    else addToCategory("Metriport could not determine", i);
  });
  return errorsByCategory;
}

// Keep this sorted from the most specific to the most generic
export const errorCategories = [
  "The requested name is valid, but no data of the requested type was found",
  "Error searching for documents in organization.",
  "Patient does not exist",
  "Body has no content.",
  "An error occurred while sending the request.",
  "is not enabled for Patient Record Sharing",
  "Patient not found",
  "No error message found",
  "Internal server error",
  "Unknown type of binary data",
  "Search result is not found", // additional: MxlAggregatorTransactionProcessor_7
  "The message timestamp is out of range",
  "Whitelist entry not found for transaction between sender edge system",
  "The patientId is unknown",
  "Metriport could not determine", // internal, declared here to keep the compiler happy :)
  "Error connecting to",
  // old categories - keeping because they might still be used by CW
  "Too many results found",
  "Invalid UUID for XDS DocumentEntry.entryUUID",
  "Unknown Patient Id Either no document was found, or patient data is secured using data governance settings", // additional: XDS
  "Unknown Patient Id", // additional: XDS
  "Failed to query patient service",
  "Error retrieving from repository",
  "Fhir Fanout Error",
  "Invalid sender",
  "Unknown Internal Error",
  "Too many requests received for the patient",
  "Too much activity", // additional: XDSRegistryBusy
  "External Gateway", // additional: Internal Registry Error
  "Error calling Intergy AuthenticateApplication",
  "XDSUnknownPatientId",
  "XDSRegistryBusy",
  "XDSRegistryError",
] as const;

export type ErrorCategory = (typeof errorCategories)[number];
