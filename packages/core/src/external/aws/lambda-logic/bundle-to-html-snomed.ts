import {
  AllergyIntolerance,
  Bundle,
  Coding,
  Condition,
  Coverage,
  DiagnosticReport,
  Encounter,
  FamilyMemberHistory,
  Immunization,
  Location,
  Medication,
  MedicationStatement,
  MedicationAdministration,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
  Resource,
  Task,
} from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { uniqWith } from "lodash";

const ISO_DATE = "YYYY-MM-DD";

const RX_NORM_CODE = "rxnorm";
const NDC_CODE = "ndc";
const SNOMED_CODE = "snomed";
const ICD_10_CODE = "icd-10";
const LOINC_CODE = "loinc";
const MEDICARE_CODE = "medicare";
const CPT_CODE = "cpt";

export const bundleToHtml = (fhirBundle: Bundle): string => {
  const {
    patient,
    medications,
    medicationAdministrations,
    medicationStatements,
    conditions,
    allergies,
    procedures,
    encounters,
  } = extractFhirTypesFromBundle(fhirBundle);

  if (!patient) {
    throw new Error("No patient found in bundle");
  }

  const htmlPage = `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <title></title>
          <!-- General CSS -->
          <style type="text/css" media="all">
  
            * {
              font-family: Verdana, Tahoma, sans-serif;
            }
  
            .title {
              text-align: center;
              font-size: 1.5rem;
            }
  
            .logo-container {
              display: flex;
              justify-content: center;
              width: 100%;
            }
  
            .logo-container img {
              height: 80px;
            }
  
            .divider {
              border: 0.5px solid lightgrey;
              margin: 20px auto;
              width: 100%;
            }
  
            .header-tables {
              display: flex;
              flex: 1;
            }
  
            .header-table {
              width: 50%;
            }
  
            .header-label {
              font-weight: bold;
              margin-right: 5px;
            }
  
            body {
              padding: 0 1rem;
            }
  
            table {
              line-height: 15pt;
              width: 100%;
              border: 1px solid black;
              border-radius: 5px;
            }
  
            thead tr,
            thead th {
              background-color: LightGrey;
              padding: 8px 5px;
            }
  
            table {
              width: 100%;
              margin: 0.3em 0;
            }
  
            tbody tr, tbody th {
              background-color: #f2f2f2;
            }
  
            tbody tr td {
              padding: 8px 5px;
            }
  
            .section {
              margin-bottom: 50px;
            }
  
            .section-title {
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
  
            .section-title a {
              text-decoration: none;
              color: black;
            }
  
            .span_button {
              display: table-cell;
              cursor: pointer;
              border: 1pt inset #585858;
              border-radius: 5px;
              -moz-border-radius: 15px;
              padding: 0.2cm 0.4cm;
              background-color: #f2f2f2;
              font-weight: bold;
              vertical-align: baseline;
            }
  
            #nav {
              border: 1px solid;
              border-radius: 5px;
              padding: 20px;
              margin: 0;
              background-color: #f2f2f2;
              display: flex;
              justify-content: space-between;
            }
  
  
            #nav .half {
              width: 50%;
            }
  
            #nav li {
              margin-bottom: 10px;
              margin-left: 20px;
            }
  
            #nav li a {
              text-decoration: none;
              color: black;
            }
  
            #report {
              border: 1px solid;
              margin-bottom: 20px;
              border-radius: 5px;
              padding: 20px;
            }
  
            #report .header {
              display: flex;
              justify-content: space-between;
            }
  
            #report .header .title {
              margin: 0;
            }
  
            #report .labs a {
              text-decoration: none;
              color: black;
            }
  
            .documentation .divider {
              display: none;
            }
  
            .reason-for-visit .divider {
              display: none;
            }
  
            #mr-header h4 {
              margin-bottom: 10px
            }
  
          </style>
        </head>
  
        <body>
          ${createMRHeader(patient)}
          <div class="divider"></div>
          <div id="mr-sections">
            ${createDischargeMedicationsSection(medications, medicationAdministrations)}
            ${createMedicationSection(medications, medicationStatements)}
            ${createConditionSection(conditions, encounters)}
            ${createAllergySection(allergies)}
            ${createProcedureSection(procedures)}
          </div>
        </body>
      </html>
    `;

  return htmlPage;
};

function formatDateForDisplay(date?: string | undefined): string {
  return date ? dayjs(date).format(ISO_DATE) : "";
}

function extractFhirTypesFromBundle(bundle: Bundle): {
  diagnosticReports: DiagnosticReport[];
  patient?: Patient | undefined;
  practitioners: Practitioner[];
  medications: Medication[];
  medicationStatements: MedicationStatement[];
  medicationAdministrations: MedicationAdministration[];
  conditions: Condition[];
  allergies: AllergyIntolerance[];
  locations: Location[];
  procedures: Procedure[];
  observationSocialHistory: Observation[];
  observationVitals: Observation[];
  observationLaboratory: Observation[];
  observationOther: Observation[];
  encounters: Encounter[];
  immunizations: Immunization[];
  familyMemberHistories: FamilyMemberHistory[];
  relatedPersons: RelatedPerson[];
  tasks: Task[];
  coverages: Coverage[];
  organizations: Organization[];
} {
  let patient: Patient | undefined;
  const practitioners: Practitioner[] = [];
  const diagnosticReports: DiagnosticReport[] = [];
  const medicationStatements: MedicationStatement[] = [];
  const medications: Medication[] = [];
  const conditions: Condition[] = [];
  const allergies: AllergyIntolerance[] = [];
  const locations: Location[] = [];
  const procedures: Procedure[] = [];
  const observationSocialHistory: Observation[] = [];
  const observationVitals: Observation[] = [];
  const observationLaboratory: Observation[] = [];
  const observationOther: Observation[] = [];
  const encounters: Encounter[] = [];
  const immunizations: Immunization[] = [];
  const familyMemberHistories: FamilyMemberHistory[] = [];
  const relatedPersons: RelatedPerson[] = [];
  const tasks: Task[] = [];
  const coverages: Coverage[] = [];
  const organizations: Organization[] = [];
  const medicationAdministrations: MedicationAdministration[] = [];

  if (bundle.entry) {
    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (resource?.resourceType === "Patient") {
        patient = resource as Patient;
      } else if (resource?.resourceType === "MedicationStatement") {
        medicationStatements.push(resource as MedicationStatement);
      } else if (resource?.resourceType === "MedicationAdministration") {
        medicationAdministrations.push(resource as MedicationAdministration);
      } else if (resource?.resourceType === "Medication") {
        medications.push(resource as Medication);
      } else if (resource?.resourceType === "Condition") {
        conditions.push(resource as Condition);
      } else if (resource?.resourceType === "Location") {
        locations.push(resource as Location);
      } else if (resource?.resourceType === "AllergyIntolerance") {
        allergies.push(resource as AllergyIntolerance);
      } else if (resource?.resourceType === "Procedure") {
        procedures.push(resource as Procedure);
      } else if (resource?.resourceType === "Observation") {
        const observation = resource as Observation;
        const isVitalSigns = observation.category?.find(
          ext => ext.coding?.[0]?.code?.toLowerCase() === "vital-signs"
        );
        const isSocialHistory = observation.category?.find(
          ext => ext.coding?.[0]?.code?.toLowerCase() === "social-history"
        );
        const isLaboratory = observation.category?.find(
          category => category.coding?.[0]?.code?.toLowerCase() === "laboratory"
        );
        const stringifyResource = JSON.stringify(resource);

        if (stringifyResource && isVitalSigns) {
          observationVitals.push(observation);
        } else if (stringifyResource && isLaboratory) {
          observationLaboratory.push(observation);
        } else if (stringifyResource && isSocialHistory) {
          observationSocialHistory.push(observation);
        } else {
          observationOther.push(observation);
        }
      } else if (resource?.resourceType === "Encounter") {
        encounters.push(resource as Encounter);
      } else if (resource?.resourceType === "Immunization") {
        immunizations.push(resource as Immunization);
      } else if (resource?.resourceType === "FamilyMemberHistory") {
        familyMemberHistories.push(resource as FamilyMemberHistory);
      } else if (resource?.resourceType === "RelatedPerson") {
        relatedPersons.push(resource as RelatedPerson);
      } else if (resource?.resourceType === "Task") {
        tasks.push(resource as Task);
      } else if (resource?.resourceType === "Coverage") {
        coverages.push(resource as Coverage);
      } else if (resource?.resourceType === "DiagnosticReport") {
        diagnosticReports.push(resource as DiagnosticReport);
      } else if (resource?.resourceType === "Practitioner") {
        practitioners.push(resource as Practitioner);
      } else if (resource?.resourceType === "Organization") {
        organizations.push(resource as Organization);
      }
    }
  }

  return {
    patient,
    practitioners,
    diagnosticReports,
    medications,
    medicationStatements,
    medicationAdministrations,
    conditions,
    allergies,
    locations,
    procedures,
    observationSocialHistory,
    observationVitals,
    observationLaboratory,
    observationOther,
    encounters,
    immunizations,
    familyMemberHistories,
    relatedPersons,
    tasks,
    coverages,
    organizations,
  };
}

function createMRHeader(patient: Patient) {
  return `
      <div id="mr-header">
        <div class='logo-container'>
          <img src="https://raw.githubusercontent.com/metriport/metriport/develop/assets/logo-black.png" alt="Logo">
        </div>
        <h1 class="title">
          Medical Record Summary (${dayjs().format(ISO_DATE)})
        </h1>
        <div class="header-tables">
          <div style="margin-right: 10px" class="header-table">
            <div >
              <h4>Patient</h4>
              <table class="header-table-patient">
                <tbody>
                  ${createHeaderTableRow(
                    "Name",
                    `${patient.name?.[0]?.given?.[0] ?? ""} ${patient.name?.[0]?.family ?? ""}`
                  )}
                  ${createHeaderTableRow("ID", patient.id ?? "")}
                  ${createHeaderTableRow("DOB", patient.birthDate ?? "")}
                  ${createHeaderTableRow("Gender", patient.gender ?? "")}
                </tbody>
              </table>
            </div>
            <div>
              <h4>Author</h4>
              <table class="header-table-author">
                <tbody>
                  ${createHeaderTableRow("Name", "Metriport")}
                  ${createHeaderTableRow("Authored On", dayjs().format(ISO_DATE))}
                </tbody>
              </table>
            </div>
            <div>
          </div>
          </div>
          <div class="header-table">
            <h4>Table of Contents</h4>
            <ul id="nav">
              <div class='half'>
                <li>
                  <a href="#medications">Medications</a>
                </li>
                <li>
                  <a href="#conditions">Conditions</a>
                </li>
                <li>
                  <a href="#allergies">Allergies</a>
                </li>
                <li>
                  <a href="#procedures"
                    >Procedures</a
                  >
                </li>
                
              </ul>
          </div>
        </div>
      </div>
    `;
}

function createHeaderTableRow(label: string, value: string) {
  return `
      <tr>
        <td>
          <span class="header-label">${label}</span>
          <span>
            ${value}
          </span>
        </td>
      </tr>
    `;
}

type EncounterTypes =
  | "labs"
  | "progressNotes"
  | "afterInstructions"
  | "reasonForVisit"
  | "documentation";

type EncounterSection = {
  [key: string]: {
    [k in EncounterTypes]?: DiagnosticReport[];
  };
};

export function createAWESection(
  diagnosticReports: DiagnosticReport[],
  practitioners: Practitioner[],
  aweVisits: Condition[],
  organization: Organization[]
) {
  const mappedPractitioners = mapResourceToId<Practitioner>(practitioners);
  const mappedOrganizations = mapResourceToId<Organization>(organization);

  if (!diagnosticReports) {
    return "";
  }

  const encounterSections: EncounterSection = buildEncounterSections({}, diagnosticReports);

  const AWEreports = buildReports(
    encounterSections,
    mappedPractitioners,
    mappedOrganizations,
    aweVisits,
    true
  );

  const hasAWEreports = AWEreports.length > 0;

  return `
      <div id="awe" class="section">
        <div class="section-title">
          <h3 id="awe" title="reports">&#x276F; Annual Wellness Exams</h3>
          <a href="#mr-header">&#x25B2; Back to Top</a>
        </div>
        <div class="section-content">
          ${
            hasAWEreports
              ? AWEreports
              : `<table><tbody><tr><td>No annual wellness exam info found</td></tr></tbody></table>`
          }
        </div>
      </div>
    `;
}

export function createDiagnosticReportsSection(
  diagnosticReports: DiagnosticReport[],
  practitioners: Practitioner[],
  aweVisits: Condition[],
  organizations: Organization[]
) {
  const mappedPractitioners = mapResourceToId<Practitioner>(practitioners);
  const mappedOrganizations = mapResourceToId<Organization>(organizations);

  if (!diagnosticReports) {
    return "";
  }

  const encounterSections: EncounterSection = buildEncounterSections({}, diagnosticReports);

  const nonAWEreports = buildReports(
    encounterSections,
    mappedPractitioners,
    mappedOrganizations,
    aweVisits,
    false
  );

  const hasNonAWEreports = nonAWEreports.length > 0;

  return `
      <div id="reports" class="section">
        <div class="section-title">
          <h3 id="reports" title="reports">&#x276F; Reports</h3>
          <a href="#mr-header">&#x25B2; Back to Top</a>
        </div>
        <div class="section-content">
          ${
            hasNonAWEreports
              ? nonAWEreports
              : `<table><tbody><tr><td>No reports found</td></tr></tbody></table>`
          }
        </div>
      </div>
    `;
}

function buildEncounterSections(
  encounterSections: EncounterSection,
  diagnosticReports: DiagnosticReport[]
): EncounterSection {
  for (const report of diagnosticReports) {
    const time = report.effectiveDateTime ?? report.effectivePeriod?.start;
    const formattedDate = dayjs(time).format(ISO_DATE) ?? "";

    if (formattedDate) {
      if (!encounterSections[formattedDate]) {
        encounterSections[formattedDate] = {};
      }

      let diagnosticReportsType: EncounterTypes | undefined = "documentation";

      if (report.category) {
        for (const iterator of report.category) {
          if (iterator.text?.toLowerCase() === "lab") {
            diagnosticReportsType = "labs";
          }
        }
      }

      if (diagnosticReportsType) {
        const reportDate = dayjs(time).format(ISO_DATE) ?? "";
        let isReportDuplicate = false;

        if (encounterSections[formattedDate]?.[diagnosticReportsType]) {
          const isDuplicate = encounterSections[formattedDate]?.[diagnosticReportsType]?.find(
            reportInside => {
              const reportInsideTime =
                reportInside.effectiveDateTime ?? reportInside.effectivePeriod?.start;
              const reportInsideDate = dayjs(reportInsideTime).format(ISO_DATE) ?? "";
              const isDuplicate = reportInsideDate === reportDate;

              return isDuplicate;
            }
          );

          isReportDuplicate = !!isDuplicate;
        }

        if (!encounterSections?.[formattedDate]?.[diagnosticReportsType]) {
          encounterSections[formattedDate] = {
            ...encounterSections[formattedDate],
            [diagnosticReportsType]: [],
          };
        }

        if (!isReportDuplicate) {
          encounterSections[formattedDate]?.[diagnosticReportsType]?.push(report);
        }
      }
    }
  }

  return encounterSections;
}

function buildReports(
  encounterSections: EncounterSection,
  mappedPractitioners: Record<string, Practitioner>,
  mappedOrganizations: Record<string, Organization>,
  aweVisits: Condition[],
  onlyAWE: boolean
) {
  return (
    Object.entries(encounterSections)
      // SORT BY ENCOUNTER DATE DESCENDING
      .sort(([keyA], [keyB]) => {
        return dayjs(keyA).isBefore(dayjs(keyB)) ? 1 : -1;
      })
      .filter(([key]) => {
        // FILTER FOR ENCOUNTERS WITH AWE DIAGNOSTIC REPORTS
        const encounterDateFormatted = dayjs(key).format(ISO_DATE);
        const aweVisit = aweVisits.find(aweVisit => {
          const aweVisitDate = aweVisit.onsetDateTime ?? "";
          const aweVisitDateFormatted = dayjs(aweVisitDate).format(ISO_DATE);

          return aweVisitDateFormatted === encounterDateFormatted;
        });

        return onlyAWE ? aweVisit : !aweVisit;
      })
      .filter(([, value]) => {
        const documentation = value.documentation;
        const note = documentation?.[0]?.presentedForm?.[0]?.data ?? "";

        const noNote = !note || note.length === 0;

        return noNote ? false : true;
      })
      .map(([key, value]) => {
        const labs = value.labs;
        const documentation = value.documentation;

        const hasNoLabs = !labs || labs?.length === 0;
        const hasNoDocumentation = !documentation || documentation?.length === 0;

        if (hasNoLabs && hasNoDocumentation) {
          return "";
        }

        return `
          <div id="report">
            <div class="header">
              <h3 class="title">Encounter</h3>
              <span>Date: ${formatDateForDisplay(key) ?? ""}</span>
            </div>
            <div>
              ${
                documentation && documentation.length > 0
                  ? createWhatWasDocumentedFromDiagnosticReports(
                      documentation,
                      mappedPractitioners,
                      mappedOrganizations
                    )
                  : ""
              }
              ${
                labs && labs.length > 0
                  ? `
                    <div class="labs">
                      <h4>Labs</h4>
                      <a href="#laboratory">Click To See Labs Section</a>
                    </div>
                    `
                  : ""
              }
  
            </div>
          </div>
      `;
      })
      .join("")
  );
}

const REMOVE_FROM_NOTE = ["xLabel", "5/5", "Â°F", "â¢", "documented in this encounter"];

function createWhatWasDocumentedFromDiagnosticReports(
  documentation: DiagnosticReport[],
  mappedPractitioners: Record<string, Practitioner>,
  mappedOrganizations: Record<string, Organization>
) {
  const documentations = documentation
    .map(documentation => {
      const note = documentation.presentedForm?.[0]?.data ?? "";
      const decodeNote = Buffer.from(note, "base64").toString("utf-8");
      const cleanNote = decodeNote.replace(new RegExp(REMOVE_FROM_NOTE.join("|"), "g"), "");

      const practitionerField = createPractionerField(documentation, mappedPractitioners);
      const organizationField = createOrganiztionField(documentation, mappedOrganizations);

      return `
          <div>
          ${practitionerField}
          ${organizationField}
            <p style="margin-bottom: 10px; line-height: 25px; white-space: pre-line;">${cleanNote}</p>
          </div>
        `;
    })
    .join("");

  return `<div class="documentation">
      <h4>Notes</h4>
      ${documentations}
    </div>`;
}

function createPractionerField(
  diagnosticReport: DiagnosticReport,
  mappedPractitioners: Record<string, Practitioner>
) {
  const practitionerRefId = diagnosticReport.performer?.[0]?.reference?.split("/")[1] ?? "";
  const practitioner = mappedPractitioners[practitionerRefId];
  const practitionerName =
    (practitioner?.name?.[0]?.given?.[0] ?? "") + " " + (practitioner?.name?.[0]?.family ?? "");
  const practitionerTitle = practitioner?.qualification?.[0]?.code?.coding?.[0]?.display ?? "";

  const hasName = practitionerName.trim().length > 0;
  const hasTitle = practitionerTitle.trim().length > 0;

  return `
    ${hasName || hasTitle ? `<span>By:` : ""}
    ${hasName ? `<span>${practitionerName}</span>` : ""}
    ${hasTitle ? `<span>${hasName ? " - " : ""}${practitionerTitle}</span>` : ""}
    `;
}

function createOrganiztionField(
  diagnosticReport: DiagnosticReport,
  mappedOrganizations: Record<string, Organization>
) {
  const organizationRefId = diagnosticReport.performer
    ?.find(performer => performer.reference?.includes("Organization"))
    ?.reference?.split("/")[1];

  const organization = mappedOrganizations[organizationRefId ?? ""];

  return organization?.name ? `<p>Facility: ${organization.name}</p>` : "";
}

function createDischargeMedicationsSection(
  medications: Medication[],
  medicationAdministrations: MedicationAdministration[]
) {
  if (!medicationAdministrations) {
    return "";
  }

  const mappedMedications = mapResourceToId<Medication>(medications);

  const medicationAdministrationsWithMedication = medicationAdministrations.filter(
    medicationAdministration => {
      const medicationId = medicationAdministration.medicationReference?.reference?.split("/")[1];
      return medicationId && mappedMedications[medicationId];
    }
  );

  const medicationAdministrationsSortedByDate = medicationAdministrationsWithMedication.sort(
    (a, b) => {
      return dayjs(a.effectivePeriod?.start).isBefore(dayjs(b.effectivePeriod?.start)) ? 1 : -1;
    }
  );

  const removeDuplicate = uniqWith(medicationAdministrationsSortedByDate, (a, b) => {
    const aDate = dayjs(a.effectivePeriod?.start).format(ISO_DATE);
    const bDate = dayjs(b.effectivePeriod?.start).format(ISO_DATE);

    return (
      aDate === bDate &&
      a.dosage?.text !== undefined &&
      b.dosage?.text !== undefined &&
      a.dosage.text === b.dosage.text
    );
  });

  const activeMedications = removeDuplicate.filter(
    medicationAdministration => medicationAdministration.status !== "stopped"
  );

  const oneYearAgo = dayjs().subtract(1, "year");

  const activeMedicationsWithinLastYear = activeMedications.filter(medicationAdministration => {
    const start = medicationAdministration.effectivePeriod?.start;
    const end = medicationAdministration.effectivePeriod?.end;
    const medicationStart = start ? dayjs(start) : undefined;
    const medicationEnd = end ? dayjs(end) : undefined;
    const isActive = medicationAdministration.status != "stopped";
    const isWithinLastYear1 = medicationStart && medicationStart.isAfter(oneYearAgo);
    const isWithinLastYear2 = medicationEnd && medicationEnd.isAfter(oneYearAgo);
    const isWithinLastYear = isWithinLastYear1 || isWithinLastYear2;
    return isActive && isWithinLastYear;
  });

  const medicationSection = createDischargeMedicationSection(
    mappedMedications,
    activeMedicationsWithinLastYear,
    "Active Medications"
  );

  const medicalTableContents = `
    ${medicationSection}
    `;

  return createSection("Discharge Medications", medicalTableContents);
}

export function createMedicationSection(
  medications: Medication[],
  medicationStatements: MedicationStatement[]
) {
  if (!medicationStatements) {
    return "";
  }

  const mappedMedications = mapResourceToId<Medication>(medications);
  //console.log("mappedMedications", mappedMedications);

  const medicationsSortedByDate = medicationStatements.sort((a, b) => {
    return dayjs(a.effectivePeriod?.start).isBefore(dayjs(b.effectivePeriod?.start)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(medicationsSortedByDate, (a, b) => {
    const aDate = dayjs(a.effectivePeriod?.start).format(ISO_DATE);
    const bDate = dayjs(b.effectivePeriod?.start).format(ISO_DATE);

    return aDate === bDate && a.dosage?.[0]?.text === b.dosage?.[0]?.text;
  });

  const activeMedications = removeDuplicate.filter(
    medicationStatement => medicationStatement.status === "active"
  );

  const oneYearAgo = dayjs().subtract(1, "year");

  const activeMedicationsWithinLastYear = activeMedications.filter(medicationStatement => {
    const start = medicationStatement.effectivePeriod?.start;
    const end = medicationStatement.effectivePeriod?.end;
    const medicationStart = start ? dayjs(start) : undefined;
    const medicationEnd = end ? dayjs(end) : undefined;
    const isActive = medicationStatement.status === "active";
    const isWithinLastYear1 = medicationStart && medicationStart.isAfter(oneYearAgo);
    const isWithinLastYear2 = medicationEnd && medicationEnd.isAfter(oneYearAgo);
    const isWithinLastYear = isWithinLastYear1 || isWithinLastYear2;
    return isActive && isWithinLastYear;
  });

  // console.log("medications", medications);
  // console.log("activeMedicationsWithinLastYear", activeMedicationsWithinLastYear);

  const activeMedicationsSection = createSectionInMedications(
    mappedMedications,
    activeMedicationsWithinLastYear,
    "Active Medications"
  );

  const medicalTableContents = `
    ${activeMedicationsSection}
    `;

  return createSection("Medications", medicalTableContents);
}

function getStartDateFromMedicationStatement(v: MedicationStatement): string | undefined {
  return v.effectivePeriod?.start;
}
function getEndDateFromMedicationStatement(v: MedicationStatement): string | undefined {
  return v.effectivePeriod?.end;
}

function getStartDateFromMedicationAdministration(v: MedicationAdministration): string | undefined {
  return v.effectivePeriod?.start;
}
function getEndDateFromMedicationAdministration(v: MedicationAdministration): string | undefined {
  return v.effectivePeriod?.end;
}

function createSectionInMedications(
  mappedMedications: Record<string, Medication>,
  medicationStatements: MedicationStatement[],
  title: string
) {
  if (medicationStatements.length <= 0) {
    const noMedFound = "No medication info found";
    return ` <h4>${title}</h4><table><tbody><tr><td>${noMedFound}</td></tr></tbody></table>`;
  }
  const medicationStatementsSortedByDate = medicationStatements.sort((a, b) => {
    const aDate = getStartDateFromMedicationStatement(a);
    const bDate = getStartDateFromMedicationStatement(b);
    if (!aDate && !bDate) return 0;
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return dayjs(aDate).isBefore(dayjs(bDate)) ? 1 : -1;
  });
  const medicalTableContents = `
        <h4>${title}</h4>
        <table>
      <thead>
        <tr>
          <th style="width: 25%">Medication</th>
          <th style="width: 25%">Instructions</th>
          <div style="width: 50%">
            <th>Dosage</th>
            <th>Status</th>
            <th>Code</th>
            <th> Start Date</th>
            <th> End Date</th>
          </div>
        </tr>
      </thead>
      <tbody>
        ${medicationStatementsSortedByDate
          .map(medicationStatement => {
            const medicationRefId =
              medicationStatement.medicationReference?.reference?.split("/")[1];
            const medication = mappedMedications[medicationRefId ?? ""];

            const code = getSpecificCode(medication?.code?.coding ?? [], [RX_NORM_CODE, NDC_CODE]);
            const blacklistInstructions = ["not defined"];

            const blacklistedInstruction = blacklistInstructions.find(instruction => {
              return medicationStatement.dosage?.[0]?.text?.toLowerCase().includes(instruction);
            });

            return `
              <tr>
                <td>${medication?.code?.text ?? ""}</td>
                <td>${
                  blacklistedInstruction ? "" : medicationStatement.dosage?.[0]?.text ?? ""
                }</td>
                <td>${
                  medicationStatement.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.value ?? ""
                } ${
              medicationStatement.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit?.replace(
                /[{()}]/g,
                ""
              ) ?? ""
            }</td>
                <td>${medicationStatement.status ?? ""}</td>
                <td>${code ?? ""}</td>
                <td>${formatDateForDisplay(
                  getStartDateFromMedicationStatement(medicationStatement)
                )}</td>
                <td>${formatDateForDisplay(
                  getEndDateFromMedicationStatement(medicationStatement)
                )}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
    `;
  return medicalTableContents;
}

function createDischargeMedicationSection(
  mappedMedications: Record<string, Medication>,
  medicationAdministrations: MedicationAdministration[],
  title: string
) {
  if (medicationAdministrations.length <= 0) {
    const noMedFound = "No medication info found";
    return ` <h4>${title}</h4><table><tbody><tr><td>${noMedFound}</td></tr></tbody></table>`;
  }
  const medicationStatementsSortedByDate = medicationAdministrations.sort((a, b) => {
    const aDate = getStartDateFromMedicationAdministration(a);
    const bDate = getStartDateFromMedicationAdministration(b);
    if (!aDate && !bDate) return 0;
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return dayjs(aDate).isBefore(dayjs(bDate)) ? 1 : -1;
  });
  const medicalTableContents = `
        <h4>${title}</h4>
        <table>
      <thead>
        <tr>
          <th style="width: 25%">Medication</th>
          <th style="width: 25%">Instructions</th>
          <div style="width: 50%">
            <th>Dosage</th>
            <th>Status</th>
            <th>Code</th>
            <th> Start Date</th>
            <th> End Date</th>
          </div>
        </tr>
      </thead>
      <tbody>
        ${medicationStatementsSortedByDate
          .map(medicationAdministration => {
            const medicationRefId =
              medicationAdministration.medicationReference?.reference?.split("/")[1];
            const medication = mappedMedications[medicationRefId ?? ""];

            const code = getSpecificCode(medication?.code?.coding ?? [], [RX_NORM_CODE, NDC_CODE]);
            const blacklistInstructions = ["not defined"];

            const blacklistedInstruction = blacklistInstructions.find(instruction => {
              return medicationAdministration.dosage?.text?.toLowerCase().includes(instruction);
            });

            return `
              <tr>
                <td>${medication?.code?.text ?? ""}</td>
                <td>${
                  blacklistedInstruction ? "" : medicationAdministration.dosage?.text ?? ""
                }</td>
                <td>${medicationAdministration.dosage?.dose?.value ?? ""} ${
              medicationAdministration.dosage?.dose?.unit?.replace(/[{()}]/g, "") ?? ""
            }</td>
                <td>${medicationAdministration.status ?? ""}</td>
                <td>${code ?? ""}</td>
                <td>${formatDateForDisplay(
                  getStartDateFromMedicationAdministration(medicationAdministration)
                )}</td>
                <td>${formatDateForDisplay(
                  getEndDateFromMedicationAdministration(medicationAdministration)
                )}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
    `;
  return medicalTableContents;
}

type RenderCondition = {
  code: string | null;
  name: string;
  firstSeen: string;
  lastSeen: string;
  clinicalStatus: string;
};

function createConditionSection(conditions: Condition[], encounter: Encounter[]) {
  if (!conditions) {
    return "";
  }

  const conditionDateDict = getConditionDatesFromEncounters(encounter);

  const removeDuplicate = uniqWith(conditions, (a, b) => {
    const aText = a.code?.text;
    const bText = b.code?.text;

    if (aText == undefined || bText == undefined) {
      return false;
    }

    const aDate = dayjs(a.onsetDateTime).format(ISO_DATE);
    const bDate = dayjs(b.onsetDateTime).format(ISO_DATE);

    return aDate === bDate && aText === bText;
  })
    .reduce((acc, condition) => {
      const codeName = getSpecificCode(condition.code?.coding ?? [], [SNOMED_CODE, ICD_10_CODE]);
      const idc10Code = condition.code?.coding?.find(code =>
        code.system?.toLowerCase().includes(SNOMED_CODE)
      );

      const name =
        idc10Code?.display ?? condition.code?.coding?.[0]?.display ?? condition.code?.text ?? "";
      const onsetDateTime = condition.onsetDateTime ?? "";
      const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.display ?? "";
      let onsetStartTime = condition.onsetPeriod?.start ?? "";
      let onsetEndTime = condition.onsetPeriod?.end ?? "";

      if (!onsetStartTime && condition.id) {
        onsetStartTime = conditionDateDict[condition.id]?.start ?? "";
      }
      if (!onsetEndTime && condition.id) {
        onsetEndTime = conditionDateDict[condition.id]?.end ?? "";
      }

      const newCondition: RenderCondition = {
        code: codeName,
        name,
        firstSeen: onsetStartTime && onsetStartTime.length ? onsetStartTime : onsetDateTime,
        lastSeen: onsetEndTime && onsetEndTime.length ? onsetEndTime : onsetDateTime,
        clinicalStatus,
      };

      const existingCondition = acc.find(
        condition => condition.code === newCondition.code && condition.name === newCondition.name
      );

      if (existingCondition) {
        // If the existing condition has a earlier first seen date, update the first seen date
        // if the existing condition has an later last seen date, update the last seen date
        if (dayjs(existingCondition.firstSeen).isAfter(dayjs(newCondition.firstSeen))) {
          existingCondition.firstSeen = newCondition.firstSeen;
        } else if (dayjs(existingCondition.lastSeen).isBefore(dayjs(newCondition.lastSeen))) {
          existingCondition.lastSeen = newCondition.lastSeen;
        }

        return acc;
      }

      acc.push(newCondition);

      return acc;
    }, [] as RenderCondition[])
    // logic to filter out conditions that are duplictates in all but date, and throw away the ones that dont have dates.
    .reduce((acc, condition) => {
      const conditionText = condition.name;
      const conditionCode = condition.code;
      const conditionDate = condition.firstSeen;

      if (conditionText == undefined || conditionCode == undefined) {
        return acc;
      }

      const existingCondition = acc.find(existingCondition => {
        const existingConditionText = existingCondition.name;
        const existingConditionCode = existingCondition.code;

        return existingConditionText === conditionText && existingConditionCode === conditionCode;
      });

      if (existingCondition) {
        // If the existing condition doesn't have a date but the new one does, replace it
        if (!existingCondition.firstSeen && conditionDate) {
          const index = acc.indexOf(existingCondition);
          acc[index] = condition;
        }
      } else {
        acc.push(condition);
      }
      return acc;
    }, [] as RenderCondition[])
    .sort((a, b) => {
      // sort the conditions so ones without dates will always be at the bottom
      if (!a.firstSeen) {
        return 1;
      }

      if (!b.firstSeen) {
        return -1;
      }

      return dayjs(a.firstSeen).isBefore(dayjs(b.firstSeen)) ? 1 : -1;
    });

  const conditionTableContents =
    removeDuplicate.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 40%">Condition</th>
          <th style="width: 15%">Code</th>
          <th style="width: 15%">First seen</th>
          <th style="width: 15%">Last seen</th>
          <th style="width: 15%">Status</th>
        </tr>
      </thead>
      <tbody>
        ${removeDuplicate
          .map(condition => {
            return `
              <tr>
                <td>${condition.name}</td>
                <td>${condition.code ?? ""}</td>
                <td>${formatDateForDisplay(condition.firstSeen)}</td>
                <td>${formatDateForDisplay(condition.lastSeen)}</td>
                <td>${condition.clinicalStatus}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No condition info found</td></tr></tbody>        </table>
        `;

  return createSection("Conditions", conditionTableContents);
}

type RenderAllergy = {
  name: string;
  manifestation: string;
  code: string | null;
  firstSeen: string;
  lastSeen: string;
  clinicalStatus: string;
};

function createAllergySection(allergies: AllergyIntolerance[]) {
  if (!allergies) {
    return "";
  }

  const removeDuplicate = uniqWith(allergies, (a, b) => {
    const aDate = dayjs(a.onsetDateTime).format(ISO_DATE);
    const bDate = dayjs(b.onsetDateTime).format(ISO_DATE);
    return aDate === bDate && a.reaction?.[0]?.substance?.text === b.reaction?.[0]?.substance?.text;
  })
    .reduce((acc, allergy) => {
      const code = getSpecificCode(allergy.code?.coding ?? [], [
        SNOMED_CODE,
        ICD_10_CODE,
        RX_NORM_CODE,
      ]);
      const name = allergy.reaction?.[0]?.substance?.text ?? "";
      const manifestation = allergy.reaction?.[0]?.manifestation?.[0]?.text ?? "";
      const onsetDateTime = allergy.onsetDateTime
        ? allergy.onsetDateTime
        : allergy.recordedDate
        ? allergy.recordedDate
        : "";
      const clinicalStatus = allergy.clinicalStatus?.coding?.[0]?.code ?? "";
      const onsetStartTime = allergy.onsetPeriod?.start;
      const onsetEndTime = allergy.onsetPeriod?.end;

      const newAllergy: RenderAllergy = {
        code,
        name,
        manifestation,
        firstSeen: onsetStartTime && onsetStartTime.length ? onsetStartTime : onsetDateTime,
        lastSeen: onsetEndTime && onsetEndTime.length ? onsetEndTime : onsetDateTime,
        clinicalStatus,
      };

      const existingAllergy = acc.find(
        allergy => allergy.code === newAllergy.code && allergy.name === newAllergy.name
      );

      if (existingAllergy) {
        // If the existing allergy has a earlier first seen date, update the first seen date
        // if the existing allergy has an later last seen date, update the last seen date
        if (dayjs(existingAllergy.firstSeen).isAfter(dayjs(newAllergy.firstSeen))) {
          existingAllergy.firstSeen = newAllergy.firstSeen;
        } else if (dayjs(existingAllergy.lastSeen).isBefore(dayjs(newAllergy.lastSeen))) {
          existingAllergy.lastSeen = newAllergy.lastSeen;
        }

        return acc;
      }

      acc.push(newAllergy);

      return acc;
    }, [] as RenderAllergy[])
    .sort((a, b) => {
      return dayjs(a.firstSeen).isBefore(dayjs(b.firstSeen)) ? 1 : -1;
    });

  const blacklistCodeText = ["no known allergies"];
  const blacklistManifestationText = ["info not available", "other"];

  const filterBlacklistText = removeDuplicate.filter(allergy => {
    const codeText = allergy.name?.toLowerCase();

    return codeText && !blacklistCodeText.includes(codeText);
  });

  const allergyTableContents =
    filterBlacklistText.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 30%">Allergy</th>
          <th style="width: 17.5%">Manifestation</th>
          <th style="width: 17.5%">Code</th>
          <th style="width: 17.5%">First Seen</th>
          <th style="width: 17.5%">Last Seen</th>
          <th style="width: 17.5%">Status</th>
        </tr>
      </thead>
      <tbody>
        ${filterBlacklistText
          .map(allergy => {
            const blacklistManifestation = blacklistManifestationText.find(manifestation => {
              return allergy.manifestation?.toLowerCase().includes(manifestation);
            });

            return `
              <tr>
                <td>${allergy.name}</td>
                <td>${blacklistManifestation ? "" : allergy.manifestation}</td>
                <td>${allergy.code}</td>
                <td>${formatDateForDisplay(allergy.firstSeen)}</td>
                <td>${formatDateForDisplay(allergy.lastSeen)}</td>
                <td>${allergy.clinicalStatus}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No allergy info found</td></tr></tbody>        </table>
        `;

  return createSection("Allergies", allergyTableContents);
}

function createProcedureSection(procedures: Procedure[]) {
  if (!procedures) {
    return "";
  }

  const proceduresSortedByDate = procedures.sort((a, b) => {
    return dayjs(a.performedDateTime).isBefore(dayjs(b.performedDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(proceduresSortedByDate, (a, b) => {
    const aDate = dayjs(a.performedDateTime).format(ISO_DATE);
    const bDate = dayjs(b.performedDateTime).format(ISO_DATE);
    return aDate === bDate && a?.text === b?.text;
  });

  const procedureTableContents =
    removeDuplicate.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 30%">Procedure</th>
          <th style="width: 17.5%">Code</th>
          <th style="width: 17.5%">Date</th>
          <th style="width: 17.5%">Status</th>
        </tr>
      </thead>
      <tbody>
        ${removeDuplicate
          .map(procedure => {
            const code = getSpecificCode(procedure.code?.coding ?? [], [
              SNOMED_CODE,
              MEDICARE_CODE,
              CPT_CODE,
            ]);

            // TODO: ADD PERFORMER FROM PRACTITIONER
            return `
              <tr>
                <td>${procedure?.code?.text ?? ""}</td>
                <td>${code ?? ""}</td>
                <td>${formatDateForDisplay(procedure.performedDateTime)}</td>
                <td>${procedure.status ?? ""}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No procedure info found</td></tr></tbody>        </table>
        `;

  return createSection("Procedures", procedureTableContents);
}

type RenderObservation = {
  display: string;
  code: string | null;
  value: string;
  firstDate: string;
  lastDate: string;
};

export function createObservationSocialHistorySection(observations: Observation[]) {
  if (!observations) {
    return "";
  }

  const observationsSortedByDate = observations.sort((a, b) => {
    return dayjs(a.effectiveDateTime).isBefore(dayjs(b.effectiveDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(observationsSortedByDate, (a, b) => {
    const aDate = dayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = dayjs(b.effectiveDateTime).format(ISO_DATE);
    const aText = a.code?.text ?? a.code?.coding?.[0]?.display;
    const bText = b.code?.text ?? b.code?.coding?.[0]?.display;
    const aValue = renderSocialHistoryValue(a) ?? "";
    const bValue = renderSocialHistoryValue(b) ?? "";
    if (aText === undefined || bText === undefined) {
      return false;
    }
    return aDate === bDate && aText === bText && aValue === bValue;
  })
    .filter(observation => {
      const value = renderSocialHistoryValue(observation) ?? "";
      const blacklistValues = ["sex assigned at birth"];
      const display = observation.code?.coding?.[0]?.display ?? "";
      const valueIsBlacklisted = blacklistValues.includes(display);

      return value && value.length > 0 && !valueIsBlacklisted;
    })
    .reduce((acc, observation) => {
      const display = observation.code?.coding?.[0]?.display ?? "";
      const value = renderSocialHistoryValue(observation) ?? "";
      const observationDate = formatDateForDisplay(observation.effectiveDateTime);
      const lastItemInArray = acc[acc.length - 1];

      if (lastItemInArray) {
        const lastItemInArrayFirstDate = lastItemInArray.firstDate;
        const lastItemInArrayLastDate = lastItemInArray.lastDate;
        const lastItemInArrayDisplay = lastItemInArray.display;
        const lastItemInArrayValue = lastItemInArray.value;

        const isSameDisplay = lastItemInArrayDisplay === display;
        const isSameValue = lastItemInArrayValue === value;

        if (isSameDisplay && isSameValue) {
          // If the existing observation has a earlier first seen date, update the first seen date
          // if the existing observation has an later last seen date, update the last seen date
          if (dayjs(lastItemInArrayFirstDate).isAfter(dayjs(observationDate))) {
            lastItemInArray.firstDate = observationDate;
          } else if (dayjs(lastItemInArrayLastDate).isBefore(dayjs(observationDate))) {
            lastItemInArray.lastDate = observationDate;
          }

          return acc;
        }
      }

      acc.push({
        display,
        code: getSpecificCode(observation.code?.coding ?? [], [
          ICD_10_CODE,
          SNOMED_CODE,
          LOINC_CODE,
        ]),
        value,
        firstDate: observationDate,
        lastDate: observationDate,
      });

      return acc;
    }, [] as RenderObservation[]);

  const observationTableContents =
    removeDuplicate.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 30%">Observation</th>
          <th style="width: 23.33333%">Value</th>
          <th style="width: 23.33333%">Code</th>
          <th style="width: 23.33333%">Date</th>
        </tr>
      </thead>
      <tbody>
        ${removeDuplicate
          .map(observation => {
            // if dates are the same just render firstdate
            const date =
              observation.firstDate === observation.lastDate
                ? observation.firstDate
                : `${observation.firstDate} - ${observation.lastDate}`;

            return `
              <tr>
                <td>${observation.display}</td>
                <td>${observation.value}</td>
                <td>${observation.code ?? ""}</td>
                <td>${formatDateForDisplay(date)}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No observation info found</td></tr></tbody>        </table>
        `;

  return createSection("Social History", observationTableContents);
}

function renderSocialHistoryValue(observation: Observation) {
  if (observation.valueQuantity) {
    const value = observation.valueQuantity?.value;
    const unit = observation.valueQuantity?.unit?.replace(/[{()}]/g, "");

    return `${value} ${unit}`;
  } else if (observation.valueCodeableConcept) {
    return (
      observation.valueCodeableConcept?.text ??
      observation.valueCodeableConcept.coding?.[0]?.display
    );
  } else {
    return "";
  }
}

export function createObservationVitalsSection(observations: Observation[]) {
  if (!observations) {
    return "";
  }

  const observationsSortedByDate = observations.sort((a, b) => {
    return dayjs(a.effectiveDateTime).isBefore(dayjs(b.effectiveDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(observationsSortedByDate, (a, b) => {
    const aDate = dayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = dayjs(b.effectiveDateTime).format(ISO_DATE);
    const aText = a.code?.text;
    const bText = b.code?.text;
    if (aText === undefined || bText === undefined) {
      return false;
    }
    return aDate === bDate && aText === bText;
  });

  const observationTableContents =
    removeDuplicate.length > 0
      ? createVitalsByDate(removeDuplicate)
      : `        <table>
        <tbody><tr><td>No observation info found</td></tr></tbody>        </table>
        `;

  return createSection("Vitals", observationTableContents);
}

function createVitalsByDate(observations: Observation[]): string {
  const filteredObservations = filterObservationsByDate(observations);

  return filteredObservations
    .map(tables => {
      const observationTableContents = `
        <table>
  
      <thead>
        <tr>
          <th style="width: 33.33333%">Observation</th>
          <th style="width: 33.33333%">Value</th>
          <th style="width: 33.33333%">Code</th>
        </tr>
      </thead>
      <tbody>
        ${tables.observations
          .map(observation => {
            const code = getSpecificCode(observation.code?.coding ?? [], [LOINC_CODE]);

            return `
              <tr>
                <td>${observation.code?.coding?.[0]?.display ?? observation.code?.text ?? ""}</td>
                <td>${renderVitalsValue(observation)}</td>
                <td>${code ?? ""}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
        `;

      return `
        <div>
          <h4>Vital Results On: ${tables.date}</h4>
          ${observationTableContents}
        </div>
        `;
    })
    .join("");
}

function renderVitalsValue(observation: Observation) {
  if (observation.valueQuantity) {
    const value = observation.valueQuantity?.value;
    const unit = observation.valueQuantity?.unit?.replace(/[{()}]/g, "");

    return `${value} ${unit}`;
  } else {
    return "";
  }
}

export function createObservationLaboratorySection(observations: Observation[]) {
  if (!observations) {
    return "";
  }

  const observationsSortedByDate = observations.sort((a, b) => {
    return dayjs(a.effectiveDateTime).isBefore(dayjs(b.effectiveDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(observationsSortedByDate, (a, b) => {
    const aDate = dayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = dayjs(b.effectiveDateTime).format(ISO_DATE);
    const aText = a.code?.text;
    const bText = b.code?.text;
    if (aText === undefined || bText === undefined) {
      return false;
    }
    return aDate === bDate && aText === bText;
  });

  const observationTableContents =
    removeDuplicate.length > 0
      ? createObservationsByDate(removeDuplicate)
      : `        <table>
        <tbody><tr><td>No laboratory info found</td></tr></tbody>        <table>
        `;

  return createSection("Laboratory", observationTableContents);
}

function createObservationsByDate(observations: Observation[]): string {
  const blacklistReferenceRangeText = ["unknown", "not detected"];

  const filteredObservations = filterObservationsByDate(observations);

  return filteredObservations
    .map(tables => {
      const observationTableContents = `
        <table>
      <thead>
          <tr>
            <th style="width: 20%">Observation</th>
            <th style="width: 20%">Value</th>
            <th style="width: 20%">Interpretation</th>
            <th style="width: 20%">Reference Range</th>
            <th style="width: 20%">Code</th>
          </tr>
        </thead>
        <tbody>
          ${tables.observations
            .filter(observation => {
              const observationDisplay = observation.code?.coding?.find(coding => {
                return coding.display;
              });

              const hasDisplayValue = observationDisplay?.display ?? observation.code?.text;

              return !!hasDisplayValue;
            })
            .map(observation => {
              const code = getSpecificCode(observation.code?.coding ?? [], [
                SNOMED_CODE,
                LOINC_CODE,
              ]);
              const blacklistReferenceRange = blacklistReferenceRangeText.find(referenceRange => {
                return observation.referenceRange?.[0]?.text
                  ?.toLowerCase()
                  .includes(referenceRange);
              });

              const constructedReferenceRange = blacklistReferenceRange
                ? ""
                : `${observation.referenceRange?.[0]?.low?.value ?? ""} ${
                    observation.referenceRange?.[0]?.low?.unit ?? ""
                  } - ${observation.referenceRange?.[0]?.high?.value ?? ""} ${
                    observation.referenceRange?.[0]?.high?.unit ?? ""
                  }`;

              const observationDisplay = observation.code?.coding?.find(coding => {
                return coding.display;
              });

              return `
                <tr>
                  <td>${observationDisplay?.display ?? observation.code?.text ?? ""}</td>
                  <td>${observation.valueQuantity?.value ?? observation.valueString ?? ""}</td>
                  <td>${observation.interpretation?.[0]?.text ?? ""}</td>
                  <td>${
                    blacklistReferenceRange
                      ? ""
                      : observation.referenceRange?.[0]?.text ?? constructedReferenceRange ?? ""
                  }</td>
                  <td>${code ?? ""}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
        </table>
        `;

      return `
        <div>
          <h4>Lab Results On: ${tables.date}</h4>
          ${observationTableContents}
        </div>
        `;
    })
    .join("");
}

export function createOtherObservationsSection(observations: Observation[]) {
  if (!observations) {
    return "";
  }

  const observationsSortedByDate = observations.sort((a, b) => {
    return dayjs(a.effectiveDateTime).isBefore(dayjs(b.effectiveDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(observationsSortedByDate, (a, b) => {
    const aDate = dayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = dayjs(b.effectiveDateTime).format(ISO_DATE);
    return aDate === bDate && a.code?.text === b.code?.text;
  }).filter(observation => {
    const value = observation.valueQuantity?.value ?? observation.valueString;

    return !!value;
  });

  const observationTableContents =
    removeDuplicate.length > 0
      ? createOtherObservationsByDate(removeDuplicate)
      : `        <table>
        <tbody><tr><td>No observation info found</td></tr></tbody>        </table>
        `;
  return createSection("Other Observations", observationTableContents);
}

function createOtherObservationsByDate(observations: Observation[]): string {
  const filteredObservations = filterObservationsByDate(observations);

  return filteredObservations
    .map(tables => {
      const observationTableContents = `
        <table>
  
        <thead>
          <tr>
            <th style="width: 33.33333%">Observation</th>
            <th style="width: 33.33333%">Value</th>
            <th style="width: 33.33333%">Code</th>
          </tr>
        </thead>
        <tbody>
          ${tables.observations
            .map(observation => {
              const code = getSpecificCode(observation.code?.coding ?? [], [
                ICD_10_CODE,
                SNOMED_CODE,
              ]);

              return `
                <tr>
                  <td>${observation.code?.coding?.[0]?.display ?? observation.code?.text ?? ""}</td>
                  <td>${observation.valueQuantity?.value ?? observation.valueString ?? ""}</td>
                  <td>${code ?? ""}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
        </table>
        `;

      return `
        <div>
          <h4>Observation Results On: ${tables.date}</h4>
          ${observationTableContents}
        </div>
        `;
    })
    .join("");
}

type FilteredObservations = { date: string; observations: Observation[] };

function filterObservationsByDate(observations: Observation[]): FilteredObservations[] {
  const filteredObservations = observations.reduce((acc, observation) => {
    const observationDate = formatDateForDisplay(observation.effectiveDateTime);
    const existingObservation = acc.find(observation => observation.date === observationDate);

    if (!observationDate.length) return acc;

    if (existingObservation) {
      existingObservation.observations.push(observation);
      return acc;
    }

    const observationDisplay = observation.code?.coding?.find(coding => {
      return coding.display;
    });

    if (observationDisplay || observation.code?.text) {
      acc.push({
        date: observationDate,
        observations: [observation],
      });
    }

    return acc;
  }, [] as FilteredObservations[]);

  return filteredObservations;
}

function renderClassDisplay(encounter: Encounter) {
  const isDisplayUndefined = encounter.class?.display === undefined;

  if (encounter.class?.display && !isDisplayUndefined) {
    return encounter.class?.display;
  } else if (encounter.class?.code && !isDisplayUndefined) {
    const extension = encounter.class?.extension?.find(coding => {
      return coding.valueCoding?.code === encounter.class?.code;
    });

    return extension?.valueCoding?.display;
  } else {
    return "";
  }
}

export function createImmunizationSection(immunizations: Immunization[]) {
  if (!immunizations) {
    return "";
  }

  const immunizationsSortedByDate = immunizations.sort((a, b) => {
    return dayjs(a.occurrenceDateTime).isBefore(dayjs(b.occurrenceDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(immunizationsSortedByDate, (a, b) => {
    const aDate = dayjs(a.occurrenceDateTime).format(ISO_DATE);
    const bDate = dayjs(b.occurrenceDateTime).format(ISO_DATE);
    return aDate === bDate && a.vaccineCode?.text === b.vaccineCode?.text;
  });

  const immunizationTableContents =
    removeDuplicate.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 30%">Immunization</th>
          <th style="width: 17.5%">Code</th>
          <th style="width: 17.5%">Manufacturer</th>
          <th style="width: 17.5%">Date</th>
          <th style="width: 17.5%">Status</th>
        </tr>
      </thead>
      <tbody>
        ${removeDuplicate
          .map(immunization => {
            const code = getSpecificCode(immunization.vaccineCode?.coding ?? [], [
              "cvx",
              RX_NORM_CODE,
            ]);

            return `
              <tr>
                <td>${immunization.vaccineCode?.text ?? ""}</td>
                <td>${code ?? ""}</td>
                <td>${immunization.manufacturer?.display ?? ""}</td>
                <td>${formatDateForDisplay(immunization.occurrenceDateTime)}</td>
                <td>${immunization.status ?? ""}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No immunization info found</td></tr></tbody>        </table>
        `;

  return createSection("Immunizations", immunizationTableContents);
}

export function createFamilyHistorySection(familyMemberHistories: FamilyMemberHistory[]) {
  if (!familyMemberHistories) {
    return "";
  }

  const removeDuplicate = uniqWith(familyMemberHistories, (a, b) => {
    return (
      renderFamilyHistoryConditions(a)?.join(", ") ===
        renderFamilyHistoryConditions(b)?.join(", ") &&
      a.relationship?.coding?.[0]?.display === b.relationship?.coding?.[0]?.display
    );
  });

  const familyMemberHistoryTableContents =
    removeDuplicate.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 17.5%">Family Member</th>
          <th style="width: 17.5%">Sex</th>
          <th style="width: 30%">Conditions</th>
          <th style="width: 17.5%">Deceased</th>
          <th style="width: 17.5%">Code</th>
        </tr>
      </thead>
      <tbody>
        ${removeDuplicate
          .map(familyMemberHistory => {
            const code = getSpecificCode(familyMemberHistory.condition?.[0]?.code?.coding ?? [], [
              ICD_10_CODE,
              SNOMED_CODE,
            ]);

            const deceasedFamilyMember = familyMemberHistory.condition?.find(condition => {
              return condition.contributedToDeath === true;
            });

            return `
              <tr>
                <td>${familyMemberHistory.relationship?.coding?.[0]?.display ?? ""}</td>
                <td>${renderAdministrativeGender(familyMemberHistory) ?? ""}</td>
                <td>${renderFamilyHistoryConditions(familyMemberHistory)?.join(", ") ?? ""}</td>
                <td>${deceasedFamilyMember ? "yes" : "no"}</td>
                <td>${code ?? ""}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No family member history
          info found</td></tr></tbody>        </table>
          `;

  return createSection("Family Member History", familyMemberHistoryTableContents);
}

function renderFamilyHistoryConditions(familyMemberHistory: FamilyMemberHistory) {
  return familyMemberHistory.condition?.map(condition => {
    return condition.code?.text ?? condition.code?.coding?.[0]?.display;
  });
}

function renderAdministrativeGender(familyMemberHistory: FamilyMemberHistory): string | null {
  const adminGenCode = familyMemberHistory.sex?.coding?.find(coding => {
    return coding.system?.toLowerCase().includes("administrativegender");
  })?.code;

  if (adminGenCode) {
    return adminGenCode;
  }

  return null;
}

export function createRelatedPersonSection(relatedPersons: RelatedPerson[]) {
  if (!relatedPersons) {
    return "";
  }

  function getName(relatedPerson: RelatedPerson) {
    return relatedPerson.name?.[0]?.text ?? "";
  }

  function getRelationship(relatedPerson: RelatedPerson) {
    return (
      relatedPerson.relationship?.[0]?.text ??
      relatedPerson.relationship?.[0]?.coding?.[0]?.display ??
      ""
    );
  }

  const removeDuplicate = uniqWith(relatedPersons, (a, b) => {
    return getName(a) === getName(b) && getRelationship(a) === getRelationship(b);
  });

  const relatedPersonTableContents =
    removeDuplicate.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 25%">Name</th>
          <th style="width: 25%">Relationship</th>
          <th style="width: 25%">Contacts</th>
          <th style="width: 25%">Addresses</th>
        </tr>
      </thead>
      <tbody>
        ${removeDuplicate
          .map(relatedPerson => {
            return `
              <tr>
                <td>${getName(relatedPerson)}</td>
                <td>${getRelationship(relatedPerson)}</td>
                <td>${renderRelatedPersonContacts(relatedPerson)?.join(", ") ?? ""}</td>
                <td>${renderRelatedPersonAddresses(relatedPerson)?.join(", ") ?? ""}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No related person info found</td></tr></tbody>        </table>
        `;

  return createSection("Related Persons", relatedPersonTableContents);
}

function renderRelatedPersonContacts(relatedPerson: RelatedPerson) {
  return relatedPerson.telecom?.map(telecom => {
    return `${telecom.system}${telecom.use ? `- ${telecom.use}` : ""}: ${telecom.value}`;
  });
}

function renderRelatedPersonAddresses(relatedPerson: RelatedPerson) {
  return relatedPerson.address?.map(address => {
    return `${address.line?.join(", ")} ${address.city}, ${address.state} ${address.postalCode}`;
  });
}

export function createTaskSection(tasks: Task[]) {
  if (!tasks) {
    return "";
  }

  const tasksSortedByDate = tasks.sort((a, b) => {
    return dayjs(a.authoredOn).isBefore(dayjs(b.authoredOn)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(tasksSortedByDate, (a, b) => {
    const aDate = dayjs(a.authoredOn).format(ISO_DATE);
    const bDate = dayjs(b.authoredOn).format(ISO_DATE);
    return aDate === bDate && a.description === b.description;
  }).filter(task => {
    // date is before 1920
    const date = dayjs(task.authoredOn).format(ISO_DATE);
    const isBefore1920 = dayjs(date).isBefore(dayjs("1920-01-01"));

    return !isBefore1920;
  });

  const taskTableContents =
    removeDuplicate.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 20%">Task</th>
          <th style="width: 20%">Reason</th>
          <th style="width: 20%">Code</th>
          <th style="width: 20%">Note</th>
          <th style="width: 20%">Date</th>
        </tr>
      </thead>
      <tbody>
        ${removeDuplicate
          .map(task => {
            const code = getSpecificCode(task.code?.coding ?? [], [SNOMED_CODE]);

            return `
              <tr>
                <td>${task.description ?? ""}</td>
                <td>${task.reasonCode?.coding?.[0]?.display ?? ""}</td>
                <td>${code ?? ""}</td>
                <td>${task.note?.[0]?.text ?? ""}</td>
                <td>${formatDateForDisplay(task.authoredOn)}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No task info found</td></tr></tbody>        </table>
        `;

  return createSection("Tasks", taskTableContents);
}

export function createEncountersSection(encounters: Encounter[], locations: Location[]) {
  const mappedLocations = mapResourceToId<Location>(locations);

  if (!encounters) {
    return "";
  }

  const encountersSortedByDate = encounters.sort((a, b) => {
    return dayjs(a.period?.start).isBefore(dayjs(b.period?.start)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(encountersSortedByDate, (a, b) => {
    const aDate = dayjs(a.period?.start).format(ISO_DATE);
    const bDate = dayjs(b.period?.start).format(ISO_DATE);
    return aDate === bDate && a.type?.[0]?.text === b.type?.[0]?.text;
  });

  // SOMETIMES IT DOESNT HAVE A REASON SHOULD WE REMOVE ALTOGETHER?
  const encounterTableContents =
    removeDuplicate.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 30%">Encounter</th>
          <th style="width: 17.5%">Location</th>
          <th style="width: 17.5%">Class</th>
          <th style="width: 17.5%">Start Date</th>
          <th style="width: 17.5%">End Date</th>
        </tr>
      </thead>
      <tbody>
        ${removeDuplicate
          .map(encounter => {
            const locationId = encounter.location?.[0]?.location?.reference?.split("/")?.[1];
            return `
              <tr>
                <td>${
                  encounter.reasonCode?.[0]?.text ??
                  encounter.reasonCode?.[0]?.coding?.[0]?.display ??
                  ""
                }</td>
                <td>${(locationId && mappedLocations[locationId]?.name) ?? ""}</td>
                <td>${renderClassDisplay(encounter)}</td>
                <td>${formatDateForDisplay(encounter.period?.start)}</td>
                <td>${formatDateForDisplay(encounter.period?.end)}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No encounter info found</td></tr></tbody>        </table>
        `;

  return createSection("Encounters", encounterTableContents);
}

export function createCoverageSection(coverages: Coverage[], organizations: Organization[]) {
  if (!coverages) {
    return "";
  }

  const mappedOrganizations = mapResourceToId<Organization>(organizations);

  const coveragesSortedByDate = coverages.sort((a, b) => {
    return dayjs(a.period?.start).isBefore(dayjs(b.period?.start)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(coveragesSortedByDate, (a, b) => {
    if (a.period?.start && b.period?.start) {
      const aDate = dayjs(a.period?.start).format(ISO_DATE);
      const bDate = dayjs(b.period?.start).format(ISO_DATE);
      return aDate === bDate && a.type?.text === b.type?.text;
    } else {
      return a.relationship?.text === b.relationship?.text;
    }
  });

  const coverageTableContents =
    removeDuplicate.length > 0
      ? `
        <table>
  
      <thead>
        <tr>
          <th style="width: 20%">Provider</th>
          <th style="width: 20%">Policy ID</th>
          <th style="width: 20%">Status</th>
          <th style="width: 20%">Start Date</th>
          <th style="width: 20%">End Date</th>
        </tr>
      </thead>
      <tbody>
        ${removeDuplicate
          .map(coverage => {
            const payorRef = coverage.payor?.[0]?.reference?.split("/")?.[1];
            const organization = mappedOrganizations[payorRef ?? ""];

            return `
              <tr>
                <td>${organization?.name ?? ""}</td>
                <td>${coverage.identifier?.[0]?.value ?? ""}</td>
                <td>${coverage.status ?? ""}</td>
                <td>${formatDateForDisplay(coverage.period?.start)}</td>
                <td>${formatDateForDisplay(coverage.period?.end)}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
      </table>
  
    `
      : `        <table>
        <tbody><tr><td>No coverage info found</td></tr></tbody>        </table>
        `;

  return createSection("Coverage", coverageTableContents);
}

function getSpecificCode(coding: Coding[], systemsList: string[]): string | null {
  // return the first code that matches the system
  // systemList should be in order of priority

  let specifiedCode: string | null = null;

  if (systemsList.length) {
    for (const system of systemsList) {
      const code = coding.find(coding => {
        return coding.system?.toLowerCase().includes(system);
      })?.code;

      if (code && !specifiedCode) {
        specifiedCode = `${system.toUpperCase()}: ${code}`;
      }
    }
  }

  return specifiedCode;
}

function getConditionDatesFromEncounters(
  encounters: Encounter[]
): Record<string, { start: string; end: string }> {
  const conditionDates: Record<string, { start: string; end: string }> = {};

  encounters.forEach(encounter => {
    if (encounter.diagnosis) {
      encounter.diagnosis.forEach(diagnosis => {
        if (diagnosis.condition && diagnosis.condition.reference) {
          const conditionId = diagnosis.condition.reference.split("/")[1];
          if (encounter.period && conditionId) {
            conditionDates[conditionId] = {
              start: encounter.period.start ?? "",
              end: encounter.period.end ?? "",
            };
          }
        }
      });
    }
  });

  return conditionDates;
}

function createSection(title: string, tableContents: string) {
  return `
      <div id="${title.toLowerCase().replace(/\s+/g, "-")}" class="section">
        <div class="section-title">
          <h3 id="${title}" title="${title}">&#x276F; ${title}</h3>
          <a href="#mr-header">&#x25B2; Back to Top</a>
        </div>
        <div class="section-content">
            ${tableContents}
        </div>
      </div>
    `;
}

function mapResourceToId<ResourceType>(resources: Resource[]): Record<string, ResourceType> {
  return resources?.reduce((acc, resource) => {
    const id = resource?.id ?? "";

    return {
      ...acc,
      [id]: resource,
    };
  }, {});
}

// find condition with code Z00 in the past year
export function getAnnualWellnessVisits(conditions: Condition[]) {
  const annualWellnessVisit = conditions.filter(condition => {
    const code = getSpecificCode(condition.code?.coding ?? [], [ICD_10_CODE]);

    return (
      code?.includes("Z00") && dayjs(condition.onsetDateTime).isAfter(dayjs().subtract(1, "y"))
    );
  });

  return annualWellnessVisit;
}
