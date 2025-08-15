import { OperationOutcome } from "@metriport/commonwell-sdk";

type CWIssues = NonNullable<OperationOutcome["content"]["issue"]>;
type SincleCWIssues = CWIssues[number];

export type CWErrorGroup = Partial<Record<ErrorCategory, CWIssues>>;

export function groupCWErrors(errors: OperationOutcome[]): CWErrorGroup {
  const errorsByCategory: Partial<Record<ErrorCategory, CWIssues>> = {};

  const addToCategory = (category: ErrorCategory, cwIssue: SincleCWIssues) => {
    const errorsOfCategory = errorsByCategory[category];
    if (errorsOfCategory) errorsOfCategory.push(cwIssue);
    else errorsByCategory[category] = [cwIssue];
  };

  const issues = errors.flatMap(e => e.content.issue ?? []);
  issues.forEach(i => {
    const category = errorCategories.find(cat => (i.details ?? "").includes(cat)) as
      | ErrorCategory
      | undefined;
    if (category) addToCategory(category, i);
    else addToCategory("Metriport could not determine", i);
  });
  return errorsByCategory;
}

// Keep this sorted from the most specific to the most generic
export const errorCategories = [
  "Too many results found",
  "Invalid UUID for XDS DocumentEntry.entryUUID",
  "Unknown Patient Id Either no document was found, or patient data is secured using data governance settings", // additional: XDS
  "Unknown Patient Id", // additional: XDS
  "The patientId is unknown",
  "Patient not found",
  "Failed to query patient service",
  "Error retrieving from repository",
  "Fhir Fanout Error",
  "Invalid sender",
  "Unknown Internal Error",
  "Too many requests received for the patient",
  "Too much activity", // additional: XDSRegistryBusy
  "External Gateway", // additional: Internal Registry Error
  "Search result is not found", // additional: MxlAggregatorTransactionProcessor_7
  "Error connecting to",
  "Error calling Intergy AuthenticateApplication",
  "XDSUnknownPatientId",
  "XDSRegistryBusy",
  "XDSRegistryError",
  "Metriport could not determine", // internal, declared here to keep the compiler happy :)
] as const;

export type ErrorCategory = (typeof errorCategories)[number];
