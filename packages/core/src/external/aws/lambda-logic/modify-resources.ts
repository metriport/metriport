import {
  Address,
  AllergyIntolerance,
  CodeableConcept,
  Condition,
  DiagnosticReport,
  HumanName,
  Immunization,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Location,
  Patient,
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

/**
 * This function applies filters to the resource based on its resourceType, and overwrites and/or creates new specific attributes,
 * making them into strings most of the time.
 *
 * TODO: #2510 - Break this function up into smaller functions, specific to each resourceType.
 *
 * @returns SlimResource
 */
export function applyResourceSpecificFilters(res: Resource): SlimResource | undefined {
  if (res.resourceType === "Patient") {
    return slimPatient(res);
  }

  if (res.resourceType === "AllergyIntolerance") {
    return slimAllergyIntolerance(res);
  }

  if (res.resourceType === "Immunization") {
    return slimImmunization(res);
  }

  if (res.resourceType === "Practitioner") {
    return slimPractitioner(res);
  }

  if (res.resourceType === "Procedure") {
    return slimProcedure(res);
  }

  if (res.resourceType === "DiagnosticReport") {
    return slimDiagnosticReport(res);
  }

  if (res.resourceType === "Observation") {
    return slimObservation(res);
  }

  if (res.resourceType === "Medication") {
    return slimMedication(res);
  }

  if (res.resourceType === "MedicationRequest") {
    return slimMedicationRequest(res);
  }

  if (res.resourceType === "MedicationStatement") {
    return slimMedicationStatement(res);
  }

  if (res.resourceType === "MedicationAdministration") {
    return slimMedicationAdministration(res);
  }

  if (res.resourceType === "Condition") {
    return slimCondition(res);
  }

  if (res.resourceType === "Organization") {
    return slimOrganization(res);
  }

  if (res.resourceType === "Location") {
    return slimLocation(res);
  }

  return undefined;
}

export type SlimPatient = Omit<Patient, "name"> & {
  name?: string | undefined;
  reference?: Record<string, string>;
};

export function slimPatient(res: Patient): SlimPatient {
  const updRes = cloneDeep(res);
  const { address, telecom, text, id, ...otherFields } = updRes;
  return {
    ...otherFields,
    name: getNameString(res.name),
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

function slimAllergyIntolerance(res: AllergyIntolerance): SlimAllergyIntolerance {
  const updRes = cloneDeep(res);
  const status = Array.from(
    new Set(updRes.clinicalStatus?.coding?.flatMap(coding => coding.code || []))
  ).join(", ");

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
    status: isUselessStatus(status) ? undefined : status,
    context,
  };
}

export type SlimImmunization = Omit<Immunization, "vaccineCode" | "site" | "route"> & {
  vaccineCode?: string | undefined;
  site?: string | undefined;
  route?: string | undefined;
  reference?: Record<string, Partial<SlimOrganization>>;
};

function slimImmunization(res: Immunization): SlimImmunization | undefined {
  if (res.vaccineCode) {
    const resVaccineCodeString = JSON.stringify(res.vaccineCode).toLowerCase();
    if (
      resVaccineCodeString.includes("no data") ||
      resVaccineCodeString.includes("no immunization")
    ) {
      return undefined;
    }
  }

  const updRes = cloneDeep(res);
  // Remove the unwanted properties directly
  delete updRes.lotNumber;
  delete updRes.doseQuantity;

  return {
    ...updRes,
    vaccineCode: getUniqueDisplaysString(res.vaccineCode),
    site: res.site?.text,
    route: getUniqueDisplaysString(res.route),
  };
}

export type SlimPractitioner = Omit<Practitioner, "name" | "qualification" | "address"> & {
  name?: string | undefined;
  qualification?: string | undefined;
  address?: string | undefined;
  reference?: Record<string, string>;
};

function slimPractitioner(res: Practitioner): SlimPractitioner {
  const updRes = cloneDeep(res);
  return {
    ...updRes,
    name: getNameString(res.name),
    qualification: getLongestDisplay(res.qualification?.[0]?.code),
    address: getAddressString(res.address),
  };
}

export type SlimProcedure = Omit<Procedure, "name" | "status" | "bodySite"> & {
  name?: string | undefined;
  status?: string | undefined;
  reference?: Record<string, string>;
  bodySite?: string | undefined;
};

function slimProcedure(res: Procedure): SlimProcedure | undefined {
  const name = getUniqueDisplaysString(res.code);
  if (name?.includes("no data")) return undefined;

  const bodySite = getUniqueDisplaysString(res.bodySite);
  const updRes = cloneDeep(res);
  delete updRes.code;
  delete updRes.reasonCode; // TODO: #2510 - Introduce term server lookup here
  delete updRes.report;
  delete updRes.note;
  return {
    ...updRes,
    name,
    status: isUselessStatus(res.status) ? undefined : res.status,
    bodySite: bodySite ?? undefined,
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
  // reference?: Record<string, string>;
  reference?: Record<string, string | object>;
};

function slimDiagnosticReport(res: DiagnosticReport): SlimDiagnosticReport | undefined {
  const mostDescriptiveType = getLongestDisplay(res.code);
  const allTypes = getUniqueDisplays(res.code);

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

  res.presentedForm?.forEach(form => {
    if (form.data) {
      const rawData = Buffer.from(form.data, "base64").toString("utf-8");
      const cleanedData = cleanUpNote(rawData);
      uniqueData.add(cleanedData);

      if (cleanedData.toLowerCase().includes("appointment scheduling letter")) {
        reportType = SCHEDULING_CALL;
      } else if (
        cleanedData.toLowerCase().includes("unable to reach") ||
        cleanedData.toLowerCase().includes("left a message")
      ) {
        reportType = UNANSWERED_CALL;
      } else if (cleanedData.toLowerCase().includes("administrative note")) {
        reportType = ADMIN_NOTE;
      } else if (
        cleanedData.toLowerCase().includes("nonva note") &&
        cleanedData.toLowerCase().includes("refer to scanned")
      ) {
        reportType = SCAN_REF_NOTE;
      } else if (cleanedData.toLowerCase().includes("discharge summary")) {
        reportType = "discharge summary";
      }
    }
  });

  if (reportType && REPORT_TYPES_BLACKLIST.includes(reportType)) {
    return undefined;
  }

  const updRes = cloneDeep(res);
  delete updRes.code;
  const category = res.category
    ?.map(cat => cat.coding?.flatMap(coding => coding.display || []))
    .join(", ");

  const status = isUselessStatus(res.status) ? undefined : (res.status as string);

  return {
    ...updRes,
    type: reportType,
    status,
    category,
    presentedForm: Array.from(uniqueData),
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

function slimObservation(res: Observation): SlimObservation {
  const updRes = cloneDeep(res);
  const refRange = res.referenceRange?.map(range => ({
    low: getQuantityString(range.low),
    high: getQuantityString(range.high),
  }));
  const status = isUselessStatus(res.status) ? undefined : (res.status as string);
  delete updRes.code;
  delete updRes.performer;
  delete updRes.valueCodeableConcept;
  delete updRes.valueQuantity;

  return {
    ...updRes,
    category: getUniqueDisplaysString(res.category),
    status,
    reading: getUniqueDisplaysString(res.code),
    value: res.valueCodeableConcept
      ? getUniqueDisplaysString(res.valueCodeableConcept)
      : getQuantityString(res.valueQuantity),
    interpretation: getUniqueDisplaysString(res.interpretation),
    referenceRange: refRange,
  };
}

export type SlimMedication = Omit<Medication, "name"> & {
  name?: string | undefined;
  reference?: Record<string, string>;
};

function slimMedication(res: Medication): SlimMedication {
  const updRes = cloneDeep(res);
  delete updRes.code;
  return {
    ...updRes,
    name: getUniqueDisplaysString(res.code),
  };
}

export type SlimMedicationRequest = Omit<MedicationRequest, "requester"> & {
  reference?: Record<string, Partial<SlimMedication>>;
};

function slimMedicationRequest(res: MedicationRequest): SlimMedicationRequest {
  const updRes = cloneDeep(res);
  delete updRes.requester;
  return {
    ...updRes,
  };
}

export type SlimMedicationStatement = Omit<MedicationStatement, "dosage"> & {
  dosages?: Dosage[] | undefined;
  reference?: Record<string, Partial<SlimMedication>>;
};

type Dosage = {
  dose: string | undefined;
  route: string | undefined;
};

function slimMedicationStatement(res: MedicationStatement): SlimMedicationStatement {
  const dosages = res.dosage?.flatMap(dosage => {
    const dose = getQuantityString(dosage.doseAndRate?.[0]?.doseQuantity);
    const route = getUniqueDisplaysString(dosage.route);
    if (!dose && !route) return [];
    return { dose, route };
  });

  const updRes = cloneDeep(res);
  delete updRes.dosage;

  return {
    ...updRes,
    dosages: dosages?.length ? dosages : undefined,
  };
}

export type SlimMedicationAdministration = Omit<
  MedicationAdministration,
  "dose" | "route" | "dosage"
> & {
  dose?: string | undefined;
  route?: string | undefined;
  reference?: Record<string, Partial<SlimMedication>>;
};

function slimMedicationAdministration(res: MedicationAdministration): SlimMedicationAdministration {
  const updRes = cloneDeep(res);
  const dose = getQuantityString(res.dosage?.dose);
  const route = getUniqueDisplaysString(res.dosage?.route);
  delete updRes.dosage;

  return {
    ...updRes,
    dose,
    route,
  };
}

export type SlimCondition = Omit<Condition, "name" | "category" | "clinicalStatus" | "code"> & {
  name?: string | undefined;
  category?: string | undefined;
  clinicalStatus?: string | undefined;
  reference?: Record<string, string | Partial<SlimPractitioner>>;
};

function slimCondition(res: Condition): SlimCondition {
  const updRes = cloneDeep(res);
  delete updRes.code;

  return {
    ...updRes,
    name: getUniqueDisplaysString(res.code),
    category: getUniqueDisplaysString(res.category),
    clinicalStatus: isUselessStatus(getUniqueDisplaysString(res.clinicalStatus))
      ? undefined
      : getUniqueDisplaysString(res.clinicalStatus),
  };
}

export type SlimOrganization = Omit<Organization, "address" | "name"> & {
  name?: string | undefined;
  address?: string | undefined;
  reference?: Record<string, string>;
};

function slimOrganization(res: Organization): SlimOrganization {
  const updRes = cloneDeep(res);
  return {
    ...updRes,
    address: getAddressString(res.address),
  };
}

export type SlimLocation = Omit<Location, "address" | "type"> & {
  address?: string | undefined;
  type?: string | undefined;
  reference?: Record<string, string>;
};

function slimLocation(res: Location): SlimLocation {
  const updRes = cloneDeep(res);
  return {
    ...updRes,
    address: getAddressString(res.address),
    type: getUniqueDisplaysString(res.type),
  };
}

function cleanUpNote(note: string): string {
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

  const uniqueDescriptors = new Set<string>();
  const concepts = toArray(concept);
  concepts.forEach(concept => {
    const text = concept.text;
    if (text) uniqueDescriptors.add(text.trim().toLowerCase());

    concept.coding?.forEach(coding => {
      if (coding.display) uniqueDescriptors.add(coding.display.trim().toLowerCase());
    });
  });

  if (uniqueDescriptors.size === 0) return undefined;
  return Array.from(uniqueDescriptors).reduce((longest, current) =>
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
    if (text) uniqueDescriptors.add(text.trim().toLowerCase());

    concept.coding?.forEach(coding => {
      if (coding.display) uniqueDescriptors.add(coding.display.trim().toLowerCase());
    });
  });

  if (uniqueDescriptors.size === 0) return undefined;
  return Array.from(uniqueDescriptors);
}

function isUselessStatus(status: string | undefined): boolean {
  return !status || status === "" || status === "final";
}

export function getNameString(names: HumanName | HumanName[] | undefined): string | undefined {
  const nameParts = new Set<string>();
  toArray(names).forEach(name => {
    delete name.use;
    name.given?.forEach(given => nameParts.add(given.trim()));
    name.family && nameParts.add(name.family?.trim());
  });

  return Array.from(nameParts).join(" ");
}
