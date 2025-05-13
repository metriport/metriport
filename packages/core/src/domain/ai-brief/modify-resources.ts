import {
  Address,
  AllergyIntolerance,
  CodeableConcept,
  Condition,
  DiagnosticReport,
  HumanName,
  Immunization,
  Location,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  Period,
  Practitioner,
  Procedure,
  Quantity,
  Resource,
} from "@medplum/fhirtypes";
import { toArray } from "@metriport/shared";
import { cloneDeep } from "lodash";

const UNANSWERED_CALL = "unanswered call";
const SCHEDULING_CALL = "scheduling call";
const ADMIN_NOTE = "admin note";
const SCAN_REF_NOTE = "scan reference";

const REPORT_TYPES_BLACKLIST = [
  "instructions",
  "addendum",
  "nursing note",
  SCHEDULING_CALL,
  UNANSWERED_CALL,
  ADMIN_NOTE,
  SCAN_REF_NOTE,
];

const REMOVE_FROM_NOTE = [
  "xLabel",
  "5/5",
  "Â°F",
  "Â",
  "â¢",
  "documented in this encounter",
  "xnoIndent",
  "Formatting of this note might be different from the original.",
  "Formatting of this note is different from the original.",
  "Portions of the history and exam were entered using voice recognition software",
  "Images from the original note were not included.",
  "Minor syntax, contextual, and spelling errors may be related to the use of this software and were not intentional. If corrections are necessary, please contact provider.",
  "<content>",
  "</content>",
  "<content/>",
  "<root>",
  "</root>",
  "&lt;",
  "&gt;",
];

export type SlimResource =
  | SlimPatient
  | SlimAllergyIntolerance
  | SlimImmunization
  | SlimPractitioner
  | SlimProcedure
  | SlimDiagnosticReport
  | SlimObservation
  | SlimMedication
  | SlimMedicationRequest
  | SlimMedicationStatement
  | SlimMedicationAdministration
  | SlimCondition
  | SlimOrganization
  | SlimLocation;

export type Instance = {
  performedDateTime?: string | undefined;
  performedPeriod?: Period | undefined;
  onsetPeriod?: Period | undefined;
};

export type SlimProcedure = Omit<
  Procedure,
  "name" | "status" | "bodySite" | "performedDateTime" | "performedPeriod"
> & {
  name?: string | undefined;
  status?: string | undefined;
  bodySite?: string | undefined;
  reference?: Record<string, unknown>[];
  instances?: Instance[];
};

/**
 * This function applies filters to the resource based on its resourceType, and overwrites and/or creates new specific attributes,
 * making them into strings most of the time.
 *
 * Since this function generates input for an LLM that doesn't require any specific shape, some of the types aren't super structured
 * and pretty, i.e. reference?: Record<string, unknown>
 *
 * TODO: #2510 - Break this function up into smaller functions, specific to each resourceType.
 *
 * @returns SlimResource
 */
export function applyResourceSpecificFilters(res: Resource): SlimResource | undefined {
  if (res.resourceType === "Patient") {
    return getSlimPatient(res);
  }

  if (res.resourceType === "AllergyIntolerance") {
    return getSlimAllergyIntolerance(res);
  }

  if (res.resourceType === "Immunization") {
    return getSlimImmunization(res);
  }

  if (res.resourceType === "Practitioner") {
    return getSlimPractitioner(res);
  }

  if (res.resourceType === "Procedure") {
    return getSlimProcedure(res);
  }

  if (res.resourceType === "DiagnosticReport") {
    return getSlimDiagnosticReport(res);
  }

  if (res.resourceType === "Observation") {
    return getSlimObservation(res);
  }

  if (res.resourceType === "Medication") {
    return getSlimMedication(res);
  }

  if (res.resourceType === "MedicationRequest") {
    return getSlimMedicationRequest(res);
  }

  if (res.resourceType === "MedicationStatement") {
    return getSlimMedicationStatement(res);
  }

  if (res.resourceType === "MedicationAdministration") {
    return getSlimMedicationAdministration(res);
  }

  if (res.resourceType === "Condition") {
    return getSlimCondition(res);
  }

  if (res.resourceType === "Organization") {
    return getSlimOrganization(res);
  }

  if (res.resourceType === "Location") {
    return getSlimLocation(res);
  }

  return undefined;
}

export type SlimPatient = Omit<Patient, "name"> & {
  name?: string | undefined;
  reference?: Record<string, string>;
};

export function getSlimPatient(res: Patient): SlimPatient {
  const updRes = cloneDeep(res);
  const name = getNameString(updRes.name);
  delete updRes.address;
  delete updRes.telecom;
  delete updRes.text;
  delete updRes.id;

  return {
    ...updRes,
    name,
  };
}

type AllergyContext = {
  substance: string | undefined;
  manifestations: string | undefined;
};

export type SlimAllergyIntolerance = Omit<
  AllergyIntolerance,
  "status" | "clinicalStatus" | "reaction"
> & {
  status?: string | undefined;
  context?: AllergyContext[] | undefined;
  reference?: Record<string, string>;
};

function getSlimAllergyIntolerance(res: AllergyIntolerance): SlimAllergyIntolerance {
  const updRes = cloneDeep(res);

  const rawStatus = Array.from(
    new Set(updRes.clinicalStatus?.coding?.flatMap(coding => coding.code || []))
  ).join(", ");
  const status = isUselessStatus(rawStatus) ? undefined : rawStatus;

  const context = updRes.reaction?.flatMap(reaction => {
    const substance = getUniqueDisplaysString(reaction.substance);
    const manifestations = getUniqueDisplaysString(reaction.manifestation);
    if (!substance && !manifestations) return [];
    return { substance, manifestations };
  });

  delete updRes.reaction;
  delete updRes.clinicalStatus;

  return {
    ...updRes,
    status,
    context,
  };
}

export type SlimImmunization = Omit<Immunization, "vaccineCode" | "site" | "route"> & {
  vaccineCode?: string | undefined;
  site?: string | undefined;
  route?: string | undefined;
  reference?: Record<string, unknown>;
};

function getSlimImmunization(res: Immunization): SlimImmunization | undefined {
  const updRes = cloneDeep(res);
  if (updRes.vaccineCode) {
    const resVaccineCodeString = JSON.stringify(updRes.vaccineCode).toLowerCase();
    if (
      resVaccineCodeString.includes("no data") ||
      resVaccineCodeString.includes("no immunization")
    ) {
      return undefined;
    }
  }
  const vaccineCode = getUniqueDisplaysString(updRes.vaccineCode);
  const site = updRes.site?.text;
  const route = getUniqueDisplaysString(updRes.route);

  delete updRes.lotNumber;
  delete updRes.doseQuantity;

  return {
    ...updRes,
    vaccineCode,
    site,
    route,
  };
}

export type SlimPractitioner = Omit<Practitioner, "name" | "qualification" | "address"> & {
  name?: string | undefined;
  qualification?: string | undefined;
  address?: string | undefined;
  reference?: Record<string, string>;
};

function getSlimPractitioner(res: Practitioner): SlimPractitioner {
  const updRes = cloneDeep(res);
  const name = getNameString(updRes.name?.slice(0, 3));

  const qualification = getLongestDisplay(updRes.qualification?.[0]?.code);
  const address = getAddressString(updRes.address);

  return {
    ...updRes,
    name,
    qualification,
    address,
  };
}

function getSlimProcedure(res: Procedure): SlimProcedure | undefined {
  const updRes = cloneDeep(res);
  const name = getUniqueDisplaysString(updRes.code);
  if (name?.includes("no data")) return undefined;
  const status = isUselessStatus(updRes.status) ? undefined : updRes.status;
  const bodySite = getUniqueDisplaysString(updRes.bodySite) ?? undefined;

  // Create initial instance from the procedure's dates
  const instance = {
    performedDateTime: updRes.performedDateTime,
    performedPeriod: updRes.performedPeriod,
  };

  delete updRes.code;
  delete updRes.reasonCode; // TODO: #2510 - Introduce term server lookup here
  delete updRes.report;
  delete updRes.note;
  delete updRes.performedDateTime;
  delete updRes.performedPeriod;

  return {
    ...updRes,
    name,
    status,
    bodySite,
    instances: [instance],
  };
}

export type SlimDiagnosticReport = Omit<
  DiagnosticReport,
  "type" | "category" | "presentedForm" | "status"
> & {
  type?: string | undefined;
  category?: string | undefined;
  presentedForm?: string[] | undefined;
  status?: string | undefined;
  reference?: Record<string, unknown>;
  encounter?: string | undefined;
};

function getSlimDiagnosticReport(res: DiagnosticReport): SlimDiagnosticReport | undefined {
  const updRes = cloneDeep(res);

  const mostDescriptiveType = getLongestDisplay(updRes.code);
  const allTypes = getUniqueDisplays(updRes.code);

  if (allTypes) {
    for (const type of allTypes) {
      if (
        REPORT_TYPES_BLACKLIST.includes(type) ||
        REPORT_TYPES_BLACKLIST.some(blacklistedType => type.includes(blacklistedType))
      ) {
        return undefined;
      }
    }
  }

  const uniqueData = new Set<string>();
  let reportType = mostDescriptiveType;

  updRes.presentedForm?.forEach(form => {
    if (form.data) {
      const rawData = Buffer.from(form.data, "base64").toString("utf-8");
      const cleanedData = cleanUpNote(rawData);
      uniqueData.add(cleanedData);
      const lowerCaseData = cleanedData.toLowerCase();

      if (lowerCaseData.includes("appointment scheduling letter")) {
        reportType = SCHEDULING_CALL;
      } else if (
        lowerCaseData.includes("unable to reach") ||
        lowerCaseData.includes("left a message")
      ) {
        reportType = UNANSWERED_CALL;
      } else if (lowerCaseData.includes("administrative note")) {
        reportType = ADMIN_NOTE;
      } else if (
        lowerCaseData.includes("nonva note") &&
        lowerCaseData.includes("refer to scanned")
      ) {
        reportType = SCAN_REF_NOTE;
      } else if (lowerCaseData.includes("discharge summary")) {
        reportType = "discharge summary";
      }
    }
  });

  // TODO: #2510 Maybe we should filter out only the specific entry rather than the entire DiagnosticReport
  if (reportType && REPORT_TYPES_BLACKLIST.includes(reportType)) {
    return undefined;
  }

  const category = toArray(updRes.category)
    ?.map(cat => cat.coding?.flatMap(coding => coding.display || []))
    .join(", ");

  const status = isUselessStatus(updRes.status) ? undefined : (updRes.status as string);
  delete updRes.code;

  return {
    ...updRes,
    type: reportType,
    status,
    category,
    presentedForm: Array.from(uniqueData),
    encounter: updRes.encounter?.reference ?? "",
  };
}

type ReferenceRange = {
  low: string | undefined;
  high: string | undefined;
};

export type SlimObservation = Omit<
  Observation,
  "category" | "reading" | "value" | "interpretation" | "referenceRange" | "status" | "code"
> & {
  category?: string | undefined;
  reading?: string | undefined;
  value?: string | undefined;
  status?: string | undefined;
  interpretation?: string | undefined;
  referenceRange?: ReferenceRange[] | undefined;
  reference?: Record<string, string>;
};

function getSlimObservation(res: Observation): SlimObservation {
  const updRes = cloneDeep(res);
  const category = getUniqueDisplaysString(updRes.category);
  const status = isUselessStatus(updRes.status) ? undefined : (updRes.status as string);
  const reading = getUniqueDisplaysString(updRes.code);
  const value = updRes.valueCodeableConcept
    ? getUniqueDisplaysString(updRes.valueCodeableConcept)
    : getQuantityString(updRes.valueQuantity);
  const interpretation = getUniqueDisplaysString(updRes.interpretation);
  const refRange = updRes.referenceRange?.map(range => ({
    low: getQuantityString(range.low),
    high: getQuantityString(range.high),
  }));

  delete updRes.code;
  delete updRes.performer;
  delete updRes.valueCodeableConcept;
  delete updRes.valueQuantity;

  return {
    ...updRes,
    category,
    status,
    reading,
    value,
    interpretation,
    referenceRange: refRange,
  };
}

export type SlimMedication = Omit<Medication, "name"> & {
  reference?: Record<string, string>;
  sideNote?: string;
  names?: string[];
};

function getSlimMedication(res: Medication): SlimMedication {
  const updRes = cloneDeep(res);
  const name = getUniqueDisplaysString(updRes.code);

  delete updRes.code;
  return {
    ...updRes,
    names: Array.from([name].flatMap(n => n ?? [])),
  };
}

export type SlimMedicationRequest = Omit<MedicationRequest, "requester" | "status"> & {
  reference?: Record<string, Partial<SlimMedication>>;
  status?: string | undefined;
};

function getSlimMedicationRequest(res: MedicationRequest): SlimMedicationRequest {
  const updRes = cloneDeep(res);
  const status = isUselessStatus(updRes.status) ? undefined : (updRes.status as string);

  delete updRes.requester;
  return {
    ...updRes,
    status,
  };
}

type Dosage = {
  dose: string | undefined;
  route: string | undefined;
};

export type SlimMedicationStatement = Omit<MedicationStatement, "dosage" | "status"> & {
  dosages?: Dosage[] | undefined;
  reference?: Record<string, Partial<SlimMedication>>;
  status?: string | undefined;
  instances?: Array<{
    date?: Period | undefined;
    dosages?: Dosage[] | undefined;
  }>;
};

function getSlimMedicationStatement(res: MedicationStatement): SlimMedicationStatement {
  const updRes = cloneDeep(res);

  const dosages = updRes.dosage?.flatMap(dosage => {
    const dose = getQuantityString(dosage.doseAndRate?.[0]?.doseQuantity);
    const route = getUniqueDisplaysString(dosage.route);
    if (!dose && !route) return [];
    return { dose, route };
  });
  const status = isUselessStatus(updRes.status) ? undefined : (updRes.status as string);

  delete updRes.dosage;

  return {
    ...updRes,
    dosages: dosages?.length ? dosages : undefined,
    status,
  };
}

export type SlimMedicationAdministration = Omit<
  MedicationAdministration,
  "dose" | "route" | "dosage" | "status"
> & {
  dose?: string | undefined;
  route?: string | undefined;
  reference?: Record<string, Partial<SlimMedication>>;
  status?: string | undefined;
};

function getSlimMedicationAdministration(
  res: MedicationAdministration
): SlimMedicationAdministration {
  const updRes = cloneDeep(res);
  const dose = getQuantityString(updRes.dosage?.dose);
  const route = getUniqueDisplaysString(updRes.dosage?.route);
  const status = isUselessStatus(updRes.status) ? undefined : (updRes.status as string);

  delete updRes.dosage;
  return {
    ...updRes,
    dose,
    route,
    status,
  };
}

export type SlimCondition = Omit<Condition, "name" | "category" | "clinicalStatus" | "code"> & {
  name?: string | undefined;
  category?: string | undefined;
  clinicalStatus?: string | undefined;
  reference?: Record<string, unknown>;
  instances?: {
    onsetPeriod?: Period | undefined;
  }[];
};

function getSlimCondition(res: Condition): SlimCondition {
  const updRes = cloneDeep(res);
  const name = getUniqueDisplaysString(updRes.code);
  const category = getUniqueDisplaysString(updRes.category);
  const clinicalStatus = isUselessStatus(getUniqueDisplaysString(updRes.clinicalStatus))
    ? undefined
    : getUniqueDisplaysString(updRes.clinicalStatus);

  delete updRes.code;

  return {
    ...updRes,
    name,
    category,
    clinicalStatus,
  };
}

export type SlimOrganization = Omit<Organization, "address" | "name"> & {
  name?: string | undefined;
  address?: string | undefined;
  reference?: Record<string, string>;
};

function getSlimOrganization(res: Organization): SlimOrganization {
  const updRes = cloneDeep(res);

  return {
    ...updRes,
    address: getAddressString(updRes.address),
  };
}

export type SlimLocation = Omit<Location, "address" | "type"> & {
  address?: string | undefined;
  type?: string | undefined;
  reference?: Record<string, string>;
};

function getSlimLocation(res: Location): SlimLocation {
  const updRes = cloneDeep(res);
  return {
    ...updRes,
    address: getAddressString(updRes.address),
    type: getUniqueDisplaysString(updRes.type),
  };
}

export function cleanUpNote(note: string): string {
  return note
    .trim()
    .replace(new RegExp(REMOVE_FROM_NOTE.join("|"), "g"), "")
    .replace(/<ID>.*?<\/ID>/g, "")
    .replace(/<styleCode>.*?<\/styleCode>/g, "")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\*{2,}/g, "*")
    .replace(/_{2,}/g, " ");
}

function getQuantityString(quantity: Quantity | undefined): string | undefined {
  if (!quantity) return undefined;
  return `${quantity.value}${quantity.unit ? ` ${quantity.unit}` : ""}`;
}

function getAddressString(address: Address | Address[] | undefined): string | undefined {
  if (!address) return undefined;

  return toArray(address)
    .map(addr => `${addr.line}, ${addr.city}, ${addr.state}`)
    .join("\n");
}

function getUniqueDisplaysString(
  concept: CodeableConcept | CodeableConcept[] | undefined
): string | undefined {
  return getUniqueDisplays(concept)?.join(", ");
}

function getLongestDisplay(
  concept: CodeableConcept | CodeableConcept[] | undefined
): string | undefined {
  if (!concept) return undefined;

  const allDisplays = getUniqueDisplays(concept);
  if (!allDisplays || allDisplays.length === 0) return undefined;

  return Array.from(allDisplays).reduce((longest, current) =>
    current.length > longest.length ? current : longest
  );
}

function getUniqueDisplays(
  concept: CodeableConcept | CodeableConcept[] | undefined
): string[] | undefined {
  if (!concept) return undefined;

  const uniqueDescriptors = new Set<string>();
  const concepts = toArray(concept);
  concepts.forEach(concept => {
    const text = concept.text;
    if (text) uniqueDescriptors.add(cleanupName(text));

    concept.coding?.forEach(coding => {
      if (coding.display) uniqueDescriptors.add(cleanupName(coding.display));
    });
  });

  if (uniqueDescriptors.size === 0) return undefined;
  return Array.from(uniqueDescriptors);
}

function cleanupName(str: string): string {
  return str.trim().replace("(finding)", "").replace("(disorder)", "").toLowerCase();
}

const uselessStatuses = ["", "final", "active", "completed"];
function isUselessStatus(status: string | undefined): boolean {
  return !status || uselessStatuses.some(useless => status === useless);
}

export function getNameString(names: HumanName | HumanName[] | undefined): string | undefined {
  const nameParts = new Set<string>();
  toArray(names).forEach(name => {
    const { given, family } = name;
    given?.forEach(givenName => nameParts.add(givenName.trim()));
    family && nameParts.add(family.trim());
  });

  return Array.from(nameParts).join(" ");
}
