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
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
  Resource,
  Task,
} from "@medplum/fhirtypes";
import { buildDayjs, sortDate } from "@metriport/shared/common/date";
import { sortObservationsForDisplay } from "@metriport/shared/medical";
import { camelCase, cloneDeep, uniqWith } from "lodash";
import { Brief } from "../../../command/ai-brief/brief";
import { fetchCodingCodeOrDisplayOrSystem } from "../../../fhir-deduplication/shared";
import {
  buildEncounterSections,
  createBrief,
  createSection,
  formatDateForDisplay,
  ISO_DATE,
  MISSING_DATE_KEY,
  MISSING_DATE_TEXT,
  getDeceasedStatus,
} from "./bundle-to-html-shared";

const RX_NORM_CODE = "rxnorm";
const NDC_CODE = "ndc";
const SNOMED_CODE = "snomed";
const ICD_10_CODE = "icd-10";
const LOINC_CODE = "loinc";
const UNK_CODE = "UNK";
const UNKNOWN_DISPLAY = "unknown";

export function bundleToHtmlDerm(fhirBundle: Bundle, brief?: Brief): string {
  const fhirTypes = extractFhirTypesFromBundle(fhirBundle);

  const {
    patient,
    practitioners,
    diagnosticReports,
    medications,
    medicationStatements,
    conditions,
    allergies,
    locations,
    observationSocialHistory,
    observationVitals,
    observationLaboratory,
    encounters,
    immunizations,
    familyMemberHistories,
  } = fhirTypes;

  const isClinicallyRelevant = hasClinicalRelevantData(fhirTypes);

  if (!isClinicallyRelevant) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medical Record Summary</title>
        </head>
        <body>
          <h1>Medical Record Summary</h1>
          <p>No clinically relevant data found in the bundle</p>
        </body>
      </html>
    `;
  }

  if (!patient) {
    throw new Error("No patient found in bundle");
  }

  const dermConditions = conditions.filter(condition => isDermCondition(condition));
  const rheumatoidConditions = conditions.filter(condition => isRheumatoidCondition(condition));
  const asthmaConditions = conditions.filter(condition => isAsthmaCondition(condition));
  const twoYearAgo = buildDayjs().subtract(2, "year").format(ISO_DATE);

  const {
    section: bpSection,
    chartSystolicData,
    chartDiastolicData,
  } = creteBPChartSection(observationVitals);

  const { section: bmiSection, chartData: bmiChartData } = createFromObservationVitalsSection(
    observationVitals,
    "BMI",
    "39156-5"
  );

  const { section: a1cSection, chartData: a1cChartData } = createFromObservationVitalsSection(
    observationLaboratory,
    "HbA1c",
    "4548-4"
  );

  const { section: cholSection, chartData: cholChartData } = createFromObservationVitalsSection(
    observationLaboratory,
    "Cholesterol",
    "2093-3"
  );

  const { section: esrSection, chartData: esrChartData } = createFromObservationVitalsSection(
    observationLaboratory,
    "ESR",
    "30341-2"
  );

  const { section: crpSection, chartData: crpChartData } = createFromObservationVitalsSection(
    observationLaboratory,
    "CRP",
    "30522-7"
  );

  const htmlPage = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
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
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-pack: center;
            -ms-flex-pack: center;
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
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-flex: 1;
            -ms-flex: 1;
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
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-align: center;
            -ms-flex-align: center;
            align-items: center;
            -webkit-box-pack: justify;
            -ms-flex-pack: justify;
            justify-content: space-between;
          }

          .section-title a {
            text-decoration: none;
            color: black;
          }

          .section-title h3 {
                white-space: nowrap;
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
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-pack: justify;
            -ms-flex-pack: justify;
            justify-content: space-between;
          }
          table #nav {
            padding: 10px;
            margin: 0;
            background-color: #f2f2f2;
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
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-pack: justify;
            -ms-flex-pack: justify;
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

          .p-line {
            white-space: pre-line;
          }

          .beta-flag {
            position: absolute;
            top: -15px;
            right: 0px;
            background-color: red;
            color: white;
            padding: 2px 10px;
            border-radius: 5px;
            font-size: 16px;
            font-weight: bold;
            z-index: 1;
          }

          #ai-brief {
            margin-top: 20px;
          }

          .brief-section-content {
            position: relative;
          }

          .brief-warning {
            border: 2px solid #FFCC00;
            background-color: #FFF8E1;
            padding: 10px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .brief-warning-icon {
            margin-right: 10px;
          }
          .brief-warning-contents {
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-align: center;
            -ms-flex-align: center;
            align-items: center;
          }
          .brief-warning-message {
            margin-left: 37px;
            margin-right: 10px;
            -webkit-box-orient: vertical;
          }

          @media print {
            #hba1cHistory {
              width: 100% !important;
              height: auto !important;
              max-width: 95vw; /* Ensures it doesn't overflow the viewport */
            }

            #bmiHistory {
              width: 100% !important;
              height: auto !important;
              max-width: 95vw; /* Ensures it doesn't overflow the viewport */
            }
          }

        </style>
      </head>

      <body>
        ${createMRHeader(patient)}
        ${createBrief(brief)}
        <div class="divider"></div>
        <div id="mr-sections">
          ${createFilteredReportSection(
            diagnosticReports,
            practitioners,
            dermConditions,
            encounters,
            locations,
            "Dermatology Notes",
            "derm",
            twoYearAgo
          )}
          ${createFilteredReportSection(
            diagnosticReports,
            practitioners,
            rheumatoidConditions,
            encounters,
            locations,
            "Rheumatology Notes",
            "rheumatoid",
            twoYearAgo
          )}
          ${createFilteredReportSection(
            diagnosticReports,
            practitioners,
            asthmaConditions,
            encounters,
            locations,
            "Asthma Notes",
            "asthma",
            twoYearAgo
          )}
          ${createDiagnosticReportsSection(
            diagnosticReports,
            practitioners,
            locations,
            [...dermConditions, ...rheumatoidConditions, ...asthmaConditions],
            encounters
          )}
          ${createConditionSection(conditions, encounters)}
          ${createFamilyHistorySection(familyMemberHistories)}
          ${createObservationSocialHistorySection(observationSocialHistory)}
          ${createMedicationSection(medications, medicationStatements)}
          ${createAllergySection(allergies)}
          ${createObservationVitalsSection(observationVitals)}
          ${bpSection}
          ${bmiSection}
          ${createObservationLaboratorySection(observationLaboratory)}
          ${a1cSection}
          ${cholSection}
          ${esrSection}
          ${crpSection}
          ${createImmunizationSection(immunizations)}
        </div>
         <script>
          ${createChartInScript({
            chartData: chartSystolicData,
            chartTitle: "Systolic",
            chartId: "bloodPressureHistory",
            secondaryData: chartDiastolicData,
            secondaryTitle: "Diastolic",
          })}
          ${createChartInScript({
            chartData: bmiChartData,
            chartTitle: "BMI",
            chartId: "bmiHistory",
          })}
          ${createChartInScript({
            chartData: a1cChartData,
            chartTitle: "HbA1c",
            chartId: "hbA1CHistory",
          })}
          ${createChartInScript({
            chartData: cholChartData,
            chartTitle: "Cholesterol",
            chartId: "cholesterolHistory",
          })}
          ${createChartInScript({
            chartData: esrChartData,
            chartTitle: "ESR",
            chartId: "esrHistory",
          })}
          ${createChartInScript({
            chartData: crpChartData,
            chartTitle: "CRP",
            chartId: "crpHistory",
          })}
        </script>
      </body>
    </html>
  `;

  return htmlPage;
}

type FhirTypes = {
  diagnosticReports: DiagnosticReport[];
  patient?: Patient | undefined;
  practitioners: Practitioner[];
  medications: Medication[];
  medicationStatements: MedicationStatement[];
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
};

// TODO: Use the version from "@metriport/core/external/fhir/shared/bundle.ts"
function extractFhirTypesFromBundle(bundle: Bundle): FhirTypes {
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

  if (bundle.entry) {
    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (resource?.resourceType === "Patient") {
        patient = resource as Patient;
      } else if (resource?.resourceType === "MedicationStatement") {
        medicationStatements.push(resource as MedicationStatement);
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
        Medical Record Summary (${formatDateForDisplay(new Date())})
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
                ${createHeaderTableRow("Authored On", formatDateForDisplay(new Date()))}
              </tbody>
            </table>
          </div>
        </div>
        <div class="header-table">
          <h4>Table of Contents</h4>
          <table><tbody><tr><td>
            <ul id="nav">
              <div class='half'>
                <li>
                  <a href="#derm">Dermatology Notes</a>
                </li>
                <li>
                  <a href="#rheumatoid">Rheumatology Notes</a>
                </li>
                <li>
                  <a href="#asthma">Asthma Notes</a>
                </li>
                <li>
                  <a href="#reports">Other Notes</a>
                </li>
                <li>
                  <a href="#conditions">Conditions</a>
                </li>
                <li>
                  <a href="#family-member-history">Family Member History</a>
                </li>
              </div>
              <div class='half'>
                <li>
                  <a href="#social-history">Social History</a>
                </li>
                <li>
                  <a href="#medications">Medications</a>
                </li>
                <li>
                  <a href="#allergies">Allergies</a>
                </li>
                <li>
                  <a href="#vitals">Vitals</a>
                </li>
                <li>
                  <a href="#laboratory">Laboratory</a>
                </li>
                <li>
                  <a href="#immunizations">Immunizations</a>
                </li>
              </div>
            </ul>
          </td></tr></tbody></table>
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

function createDiagnosticReportsSection(
  diagnosticReports: DiagnosticReport[],
  practitioners: Practitioner[],
  locations: Location[],
  conditions: Condition[],
  encounters: Encounter[]
) {
  const mappedPractitioners = mapResourceToId<Practitioner>(practitioners);

  if (!diagnosticReports) {
    return "";
  }

  const visitDateDict = getConditionDatesFromEncounters(encounters);

  const encounterSections = buildEncounterSections(diagnosticReports);

  const encountersWithoutAWEAndADHD = Object.entries(encounterSections)
    .filter(([key]) => {
      const encounterDate = key;
      const leftOverVisit = conditions.find(condition => {
        const visitId = condition.id ?? "";
        const visitVisitDate = condition.onsetDateTime
          ? condition.onsetDateTime
            ? condition.onsetPeriod?.start
            : condition.onsetPeriod?.start
          : visitDateDict[visitId]?.start;

        return visitVisitDate === encounterDate;
      });

      return !leftOverVisit;
    })
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as EncounterSection);

  const twoYearAgo = buildDayjs().subtract(2, "year").format(ISO_DATE);

  const nonAWEreports = buildReports(
    encountersWithoutAWEAndADHD,
    mappedPractitioners,
    encounters,
    locations,
    twoYearAgo,
    [],
    false
  );

  const hasNonAWEreports = nonAWEreports.length > 0;

  return `
    <div id="reports" class="section">
      <div class="section-title">
        <h3 id="reports" title="reports">&#x276F; Other Notes</h3>
        <a href="#mr-header">&#x25B2; Back to Top</a>
      </div>
      <div class="section-content">
        ${
          hasNonAWEreports
            ? nonAWEreports
            : `<table><tbody><tr><td>No visit notes found</td></tr></tbody></table>`
        }
      </div>
    </div>
  `;
}

type DiagnosticIdWithDateAndLocation = {
  diagnosticReportId: string;
  locationRefName: string | undefined;
  date: string;
};

function createFilteredReportSection(
  diagnosticReports: DiagnosticReport[],
  practitioners: Practitioner[],
  filterConditions: Condition[],
  encounters: Encounter[],
  locations: Location[],
  title: string,
  tag: string,
  dateFilter?: string
) {
  const mappedPractitioners = mapResourceToId<Practitioner>(practitioners);

  if (!diagnosticReports) {
    return "";
  }

  const encounterSections = buildEncounterSections(diagnosticReports);

  const conditionDateDict = getConditionDatesFromEncounters(encounters);

  const encountersWithCondition = Object.entries(encounterSections)
    .filter(([key]) => {
      const encounterDate = key;
      const conditionVisit = filterConditions.find(condition => {
        const conditionId = condition.id ?? "";
        const conditionVisitDate = condition.onsetDateTime
          ? condition.onsetDateTime
            ? condition.onsetPeriod?.start
            : condition.onsetPeriod?.start
          : conditionDateDict[conditionId]?.start;

        const isoCondition = buildDayjs(conditionVisitDate).format(ISO_DATE);

        return isoCondition === encounterDate;
      });

      return conditionVisit;
    })
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as EncounterSection);

  const conditionReports = buildReports(
    encountersWithCondition,
    mappedPractitioners,
    encounters,
    locations,
    dateFilter,
    filterConditions,
    true
  );

  const hasConditionReports = conditionReports.length > 0;

  return `
    <div id="${tag}" class="section">
      <div class="section-title">
        <h3 id="${tag}" title="reports">&#x276F; ${title}</h3>
        <a href="#mr-header">&#x25B2; Back to Top</a>
      </div>
      <div class="section-content">
        ${
          hasConditionReports
            ? conditionReports
            : `<table><tbody><tr><td>${title} may not be present</td></tr></tbody></table>`
        }
      </div>
    </div>
  `;
}

function buildReports(
  encounterSections: EncounterSection,
  mappedPractitioners: Record<string, Practitioner>,
  encounters: Encounter[],
  locations: Location[],
  dateFilter?: string,
  conditions?: Condition[],
  latest?: boolean
) {
  const docsWithNotes = filterEncounterSections(encounterSections);

  const sortedAndFilteredNotes = Object.entries(docsWithNotes)
    // SORT BY ENCOUNTER DATE DESCENDING
    .sort(([keyA], [keyB]) => {
      if (keyA === MISSING_DATE_KEY) return 1;
      if (keyB === MISSING_DATE_KEY) return -1;
      return buildDayjs(keyA).isBefore(buildDayjs(keyB)) ? 1 : -1;
    })
    .slice(0, latest ? 1 : undefined)
    .filter(([key]) => {
      if (dateFilter) {
        if (key === MISSING_DATE_KEY) return false;
        const encounterDate = key;
        return encounterDate > dateFilter;
      }

      return true;
    })
    .filter(([, value]) => {
      const documentation = value.documentation;
      const validDocumentation = documentation?.filter(doc => {
        const containsB64InAnyPresentedForm = doc.presentedForm?.some(form => {
          const note = form.data ?? "";
          const decodeNote = Buffer.from(note, "base64").toString("utf-8");
          return decodeNote.includes("^application^pdf^BASE64^");
        });

        return !containsB64InAnyPresentedForm;
      });

      return validDocumentation && validDocumentation.length > 0;
    });

  const notesBySpecialty = getLatestDrPerSpecialty(
    Object.fromEntries(sortedAndFilteredNotes),
    encounters,
    locations
  );

  return Object.entries(notesBySpecialty)
    .map(([key, value]) => {
      const labs = value.labs;
      const documentation = value.documentation;

      const hasNoLabs = !labs || labs?.length === 0;
      const hasNoDocumentation = !documentation || documentation?.length === 0;

      if (hasNoLabs && hasNoDocumentation) {
        return "";
      }

      const conditionDateDict = getConditionDatesFromEncounters(encounters);

      const condition = conditions?.find(condition => {
        const conditionId = condition.id ?? "";
        const conditionVisitDate = condition.onsetDateTime
          ? condition.onsetDateTime
          : conditionDateDict[conditionId]?.start;

        const encounterDate = key;
        const conditionVisitDateFormatted = buildDayjs(conditionVisitDate).format(ISO_DATE);

        return conditionVisitDateFormatted === encounterDate;
      });

      const codeName = getSpecificCode(condition?.code?.coding ?? [], [ICD_10_CODE]);

      const idc10Code = condition?.code?.coding?.find(code =>
        code.system?.toLowerCase().includes(ICD_10_CODE)
      );

      const name =
        idc10Code?.display ??
        getValidCode(condition?.code?.coding)[0]?.display ??
        condition?.code?.text ??
        "";

      return `
        <div id="report">
          <div class="header">
            <h3 class="title">Encounter</h3>
            <span>Date: ${key === MISSING_DATE_KEY ? MISSING_DATE_TEXT : key}</span>
          </div>
          <div>
            ${condition ? `<h4>Diagnosis</h4><p>${name} - ${codeName}</p>` : ""}
          </div>
          <div>
            ${
              documentation && documentation.length > 0
                ? createWhatWasDocumentedFromDiagnosticReports(
                    documentation,
                    encounters,
                    locations,
                    mappedPractitioners
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
    .join("");
}

function getLatestDrPerSpecialty(
  encounterSections: EncounterSection,
  encounters: Encounter[],
  locations: Location[]
): EncounterSection {
  const diagnosticReports = Object.values(encounterSections).flatMap(section => {
    if (!section.documentation) {
      return [];
    }

    return section.documentation;
  });
  const mappedDiagnosticReports = mapResourceToId<DiagnosticReport>(diagnosticReports);
  const mappedEncounters = mapResourceToId<Encounter>(encounters);
  const mappedLocations = mapResourceToId<Location>(locations);

  const diagnosticReportWithDate: DiagnosticIdWithDateAndLocation[] = [];

  for (const diagnosticReport of diagnosticReports) {
    const encounterRefId = diagnosticReport.encounter?.reference?.split("/")[1];
    const encounter = mappedEncounters[encounterRefId ?? ""];
    const diagnosticReportId = diagnosticReport.id ?? "";
    const locationRefId = encounter?.location?.[0]?.location?.reference?.split("/")[1];
    const location = mappedLocations[locationRefId ?? ""];

    const time = diagnosticReport.effectiveDateTime ?? diagnosticReport.effectivePeriod?.start;
    const formattedDate = formatDateForDisplay(time);

    diagnosticReportWithDate.push({
      diagnosticReportId,
      locationRefName: location ? location.name : undefined,
      date: formattedDate,
    });
  }

  const latestDiagnosticReportPerSpecialty = diagnosticReportWithDate.reduce(
    (acc: DiagnosticIdWithDateAndLocation[], curr) => {
      const specialtyExists = acc.find(report => report.locationRefName === curr.locationRefName);

      if (!specialtyExists || !curr.locationRefName) {
        acc.push(curr);
      } else {
        const latestSpecialtyReportDate = buildDayjs(specialtyExists.date);
        const isSameDate = buildDayjs(curr.date).isSame(latestSpecialtyReportDate);
        const isAfterDate = buildDayjs(curr.date).isAfter(latestSpecialtyReportDate);

        const planOfCareCode = "18776-5";
        const telephoneEncounterCode = "34748-4";
        const addendumDocumentCode = "55107-7";

        const invalidCodes = [planOfCareCode, telephoneEncounterCode, addendumDocumentCode];

        const originalDiagnosticReport =
          mappedDiagnosticReports[specialtyExists.diagnosticReportId];
        const originalLoincCodes = originalDiagnosticReport?.code?.coding?.filter(code =>
          code.system?.includes("loinc")
        );
        const originalHasInvalidCode = originalLoincCodes?.some(code =>
          invalidCodes.includes(code.code ?? "")
        );

        const currlDiagnosticReport = mappedDiagnosticReports[curr.diagnosticReportId];
        const currlLoincCodes = currlDiagnosticReport?.code?.coding?.filter(code =>
          code.system?.includes("loinc")
        );
        const currlHasInvalidCode = currlLoincCodes?.some(code =>
          invalidCodes.includes(code.code ?? "")
        );

        const canOverideInvalid = originalHasInvalidCode && !currlHasInvalidCode;
        const bothInvalid = originalHasInvalidCode && currlHasInvalidCode;
        const isSameOrAfter = isSameDate || isAfterDate;

        if (
          canOverideInvalid ||
          (isSameOrAfter && bothInvalid) ||
          (isSameOrAfter && !currlHasInvalidCode)
        ) {
          acc = acc.filter(report => report.locationRefName !== curr.locationRefName);
          acc.push(curr);
        }
      }

      return acc;
    },
    []
  );

  const reportsBySpecialty: DiagnosticReport[] = [];

  for (const report of latestDiagnosticReportPerSpecialty) {
    const diagnosticReport = mappedDiagnosticReports[report.diagnosticReportId];

    if (diagnosticReport) {
      reportsBySpecialty.push(diagnosticReport);
    }
  }

  const encounterSectionsBySpecialty = buildEncounterSections(reportsBySpecialty);

  return encounterSectionsBySpecialty;
}

function filterEncounterSections(encounterSections: EncounterSection): EncounterSection {
  return Object.entries(encounterSections).reduce((acc, [key, value]) => {
    const documentation = value.documentation?.filter(doc => {
      const hasValidNote = doc.presentedForm?.some(form => {
        const note = form.data ?? "";
        return note && note.length > 0;
      });

      return hasValidNote;
    });

    acc[key] = {
      ...value,
      documentation: documentation && documentation.length > 0 ? documentation : [],
    };

    return acc;
  }, {} as EncounterSection);
}

const REMOVE_FROM_NOTE = [
  "xLabel",
  "5/5",
  "Â°F",
  "â¢",
  "documented in this encounter",
  "xnoIndent",
  "Formatting of this note might be different from the original.",
  "StartCited",
  "EndCited",
];

function cleanUpNote(note: string): string {
  return note
    .trim()
    .replace(new RegExp(REMOVE_FROM_NOTE.join("|"), "g"), "")
    .replace(/<ID>.*?<\/ID>/g, "")
    .replace(/<styleCode>.*?<\/styleCode>/g, "")
    .replace(/<width>.*?<\/width>/g, "") // https://metriport.slack.com/archives/C0616FCPAKZ/p1722627448791109?thread_ts=1722612577.018299&cid=C0616FCPAKZ
    .replace(/(<paragraph>|<content>)/g, '<p class="p-line">') // https://metriport.slack.com/archives/C0616FCPAKZ/p1722625692474229?thread_ts=1722612577.018299&cid=C0616FCPAKZ
    .replace(/(<paragraph\s?\/>|<content\s?\/>)/g, "<p>&nbsp;</p>") // https://metriport.slack.com/archives/C0616FCPAKZ/p1722625692474229?thread_ts=1722612577.018299&cid=C0616FCPAKZ
    .replace(/(<\/paragraph>|<\/content>)/g, "</p>"); // https://metriport.slack.com/archives/C0616FCPAKZ/p1722625692474229?thread_ts=1722612577.018299&cid=C0616FCPAKZ
}

function removeEncodedStrings(valueString: string): string {
  return valueString.replace(/&#x3D;/g, "").trim();
}

function createWhatWasDocumentedFromDiagnosticReports(
  documentation: DiagnosticReport[],
  encounters: Encounter[],
  locations: Location[],
  mappedPractitioners: Record<string, Practitioner>
) {
  const documentations = documentation
    .map(doc => {
      const notes =
        doc.presentedForm?.map(form => {
          const note = form.data ?? "";
          const noJunkNote = removeEncodedStrings(note);
          const decodeNote = Buffer.from(noJunkNote, "base64").toString("utf-8");
          return cleanUpNote(decodeNote);
        }) ?? [];

      const practitionerField = createPractitionerField(doc, mappedPractitioners);
      const organizationField = createOrganizationField(doc, encounters, locations);

      const fields = [practitionerField, organizationField].filter(
        field => field.trim().length > 0
      );
      return `
      <div data-id="${doc.id}">
        ${fields.join("<br />")}
        ${
          notes.length > 0
            ? `<p style="margin-bottom: 10px; line-height: 25px; white-space: pre-line;">${notes.join(
                "<br />"
              )}</p>`
            : ""
        }
      </div>
      `;
    })
    .join("");

  return `<div class="documentation">
    <h4>Notes</h4>
    ${documentations}
  </div>`;
}

function createPractitionerField(
  diagnosticReport: DiagnosticReport,
  mappedPractitioners: Record<string, Practitioner>
) {
  const practitionerRefId = diagnosticReport.performer?.[0]?.reference?.split("/")[1] ?? "";
  const practitioner = mappedPractitioners[practitionerRefId];
  const practitionerName =
    (practitioner?.name?.[0]?.given?.[0] ?? "") + " " + (practitioner?.name?.[0]?.family ?? "");
  const practitionerTitle =
    getValidCode(practitioner?.qualification?.[0]?.code?.coding)[0]?.display ?? "";

  const hasName = practitionerName.trim().length > 0;
  const hasTitle = practitionerTitle.trim().length > 0;

  return `
  ${hasName || hasTitle ? `<span>By:` : ""}
  ${hasName ? `<span>${practitionerName}</span>` : ""}
  ${hasTitle ? `<span>${hasName ? " - " : ""}${practitionerTitle}</span>` : ""}
  `;
}

function createOrganizationField(
  diagnosticReport: DiagnosticReport,
  encounters: Encounter[],
  locations: Location[]
) {
  const mappedEncounters = mapResourceToId<Encounter>(encounters);
  const mappedLocation = mapResourceToId<Location>(locations);

  const encounterRefId = diagnosticReport.encounter?.reference?.split("/")[1];

  const encounter = mappedEncounters[encounterRefId ?? ""];

  const locationRefId = encounter?.location?.[0]?.location?.reference?.split("/")?.[1];

  const location = mappedLocation[locationRefId ?? ""];

  return location ? `<p>Facility: ${location.name}</p>` : "";
}

function createMedicationSection(
  medications: Medication[],
  medicationStatements: MedicationStatement[]
) {
  if (!medicationStatements) {
    return "";
  }

  const mappedMedications = mapResourceToId<Medication>(medications);

  const medicationsSortedByDate = medicationStatements.sort((a, b) =>
    sortDate(a.effectivePeriod?.start, b.effectivePeriod?.start)
  );
  const removeDuplicate = uniqWith(medicationsSortedByDate, (a, b) => {
    const aDate = buildDayjs(a.effectivePeriod?.start).format(ISO_DATE);
    const bDate = buildDayjs(b.effectivePeriod?.start).format(ISO_DATE);

    return aDate === bDate && a.dosage?.[0]?.text === b.dosage?.[0]?.text;
  }).filter(medicationStatement => {
    const medicationDate = medicationStatement.effectivePeriod?.start ?? "";
    const medicationDateFormatted = buildDayjs(medicationDate);
    const twoYearAgo = buildDayjs().subtract(2, "year");

    return medicationDateFormatted.isAfter(twoYearAgo);
  });

  const medicationsSection = createSectionInMedications(
    mappedMedications,
    removeDuplicate,
    "All Medications"
  );

  const medicalTableContents = `
  ${medicationsSection}
  `;

  return createSection("Medications", medicalTableContents);
}

function getDateFormMedicationStatement(v: MedicationStatement): string | undefined {
  return v.effectivePeriod?.start;
}

function createSectionInMedications(
  mappedMedications: Record<string, Medication>,
  medicationStatements: MedicationStatement[],
  title: string
) {
  if (medicationStatements.length <= 0) {
    const noMedFound = "No structured medication info found in health information exchange";
    return ` <h4>${title}</h4><table><tbody><tr><td>${noMedFound}</td></tr></tbody></table>`;
  }
  const medicationStatementsSortedByDate = medicationStatements.sort((a, b) => {
    const aDate = getDateFormMedicationStatement(a);
    const bDate = getDateFormMedicationStatement(b);
    if (!aDate && !bDate) return 0;
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    return buildDayjs(aDate).isBefore(buildDayjs(bDate)) ? 1 : -1;
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
          <th>Code</th>
          <th>Date</th>
        </div>
      </tr>
    </thead>
    <tbody>
      ${medicationStatementsSortedByDate
        .map(medicationStatement => {
          const medicationRefId = medicationStatement.medicationReference?.reference?.split("/")[1];
          const medication = mappedMedications[medicationRefId ?? ""];

          const code = getSpecificCode(medication?.code?.coding ?? [], [RX_NORM_CODE, NDC_CODE]);
          const blacklistInstructions = ["not defined"];

          const blacklistedInstruction = blacklistInstructions.find(instruction => {
            return medicationStatement.dosage?.[0]?.text?.toLowerCase().includes(instruction);
          });

          return `
            <tr data-id"${medicationStatement.id}">
              <td>${medication?.code?.text ?? ""}</td>
              <td>${blacklistedInstruction ? "" : medicationStatement.dosage?.[0]?.text ?? ""}</td>
              <td>${medicationStatement.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.value ?? ""} ${
            medicationStatement.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit?.replace(
              /[{()}]/g,
              ""
            ) ?? ""
          }</td>
              <td>${code ?? ""}</td>
              <td>${formatDateForDisplay(getDateFormMedicationStatement(medicationStatement))}</td>
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
  id: string | undefined;
  code: string | null;
  name: string;
  firstSeen: string | undefined;
  lastSeen: string | undefined;
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

    const aDate = buildDayjs(a.onsetDateTime).format(ISO_DATE);
    const bDate = buildDayjs(b.onsetDateTime).format(ISO_DATE);

    return aDate === bDate && aText === bText;
  })
    .reduce((acc, condition) => {
      const codeName = getSpecificCode(condition.code?.coding ?? [], [ICD_10_CODE, SNOMED_CODE]);
      const idc10Code = condition.code?.coding?.find(code =>
        code.system?.toLowerCase().includes(ICD_10_CODE)
      );

      const name =
        idc10Code?.display ??
        getValidCode(condition.code?.coding)[0]?.display ??
        condition.code?.text ??
        "";
      const onsetDateTime = condition.onsetDateTime;
      const clinicalStatus = getValidCode(condition.clinicalStatus?.coding)[0]?.display ?? "";
      let onsetStartTime = condition.onsetPeriod?.start;
      let onsetEndTime = condition.onsetPeriod?.end;

      if (!onsetStartTime && condition.id) {
        onsetStartTime = conditionDateDict[condition.id]?.start;
      }
      if (!onsetEndTime && condition.id) {
        onsetEndTime = conditionDateDict[condition.id]?.end;
      }

      const newCondition: RenderCondition = {
        id: condition.id,
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
        if (buildDayjs(existingCondition.firstSeen).isAfter(buildDayjs(newCondition.firstSeen))) {
          existingCondition.firstSeen = newCondition.firstSeen;
        } else if (
          buildDayjs(existingCondition.lastSeen).isBefore(buildDayjs(newCondition.lastSeen))
        ) {
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

      return buildDayjs(a.firstSeen).isBefore(buildDayjs(b.firstSeen)) ? 1 : -1;
    })
    .filter(condition => isWithinLastTwoYears(condition.firstSeen));

  const conditionTableContents =
    removeDuplicate.length > 0
      ? `
      <table>

    <thead>
      <tr>
        <th style="width: 40%">Condition</th>
        <th style="width: 20%">Code</th>
        <th style="width: 20%">First seen</th>
        <th style="width: 20%">Last seen</th>
      </tr>
    </thead>
    <tbody>
      ${removeDuplicate
        .map(condition => {
          return `
            <tr data-id="${condition.id}">
              <td>${condition.name}</td>
              <td>${condition.code ?? ""}</td>
              <td>${formatDateForDisplay(condition.firstSeen)}</td>
              <td>${formatDateForDisplay(condition.lastSeen)}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
    </table>

  `
      : `        <table>
      <tbody><tr><td>No structured condition info found in health information exchange</td></tr></tbody>        </table>
      `;

  return createSection("Conditions", conditionTableContents);
}

type RenderAllergy = {
  id: string | undefined;
  name: string;
  manifestation: string;
  code: string | null;
  firstSeen: string | undefined;
  lastSeen: string | undefined;
  clinicalStatus: string;
};

function createAllergySection(allergies: AllergyIntolerance[]) {
  if (!allergies) {
    return "";
  }

  const removeDuplicate = uniqWith(allergies, (a, b) => {
    const aDate = buildDayjs(a.onsetDateTime).format(ISO_DATE);
    const bDate = buildDayjs(b.onsetDateTime).format(ISO_DATE);
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
        : undefined;
      const clinicalStatus = allergy.clinicalStatus?.coding?.[0]?.code ?? "";
      const onsetStartTime = allergy.onsetPeriod?.start;
      const onsetEndTime = allergy.onsetPeriod?.end;

      const newAllergy: RenderAllergy = {
        id: allergy.id,
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
        if (buildDayjs(existingAllergy.firstSeen).isAfter(buildDayjs(newAllergy.firstSeen))) {
          existingAllergy.firstSeen = newAllergy.firstSeen;
        } else if (buildDayjs(existingAllergy.lastSeen).isBefore(buildDayjs(newAllergy.lastSeen))) {
          existingAllergy.lastSeen = newAllergy.lastSeen;
        }

        return acc;
      }

      acc.push(newAllergy);

      return acc;
    }, [] as RenderAllergy[])
    .sort((a, b) => sortDate(a.firstSeen, b.firstSeen))
    .filter(allergy => isWithinLastTwoYears(allergy.firstSeen));

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
      </tr>
    </thead>
    <tbody>
      ${filterBlacklistText
        .map(allergy => {
          const blacklistManifestation = blacklistManifestationText.find(manifestation => {
            return allergy.manifestation?.toLowerCase().includes(manifestation);
          });

          return `
            <tr data-id="${allergy.id}">
              <td>${allergy.name}</td>
              <td>${blacklistManifestation ? "" : allergy.manifestation}</td>
              <td>${allergy.code}</td>
              <td>${formatDateForDisplay(allergy.firstSeen)}</td>
              <td>${formatDateForDisplay(allergy.lastSeen)}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
    </table>

  `
      : `        <table>
      <tbody><tr><td>No structured allergy info found in health information exchange</td></tr></tbody>        </table>
      `;

  return createSection("Allergies", allergyTableContents);
}

type RenderObservation = {
  display: string;
  code: string | null;
  value: string;
  firstDate: string;
  lastDate: string;
};

function createObservationSocialHistorySection(observations: Observation[]) {
  if (!observations) {
    return "";
  }

  const observationsSortedByDate = observations.sort((a, b) =>
    sortDate(a.effectiveDateTime, b.effectiveDateTime)
  );

  const removeDuplicate = uniqWith(observationsSortedByDate, (a, b) => {
    const aDate = buildDayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = buildDayjs(b.effectiveDateTime).format(ISO_DATE);
    const aText = a.code?.text ?? getValidCode(a.code?.coding)[0]?.display;
    const bText = b.code?.text ?? getValidCode(b.code?.coding)[0]?.display;
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
      const display = getValidCode(observation.code?.coding)[0]?.display ?? "";
      const valueIsBlacklisted = blacklistValues.includes(display);

      return value && value.length > 0 && !valueIsBlacklisted;
    })
    .reduce((acc, observation) => {
      const display = getValidCode(observation.code?.coding)[0]?.display ?? "";
      const value = renderSocialHistoryValue(observation) ?? "";
      const observationDate = formatDateForDisplay(observation.effectiveDateTime);
      const firstDate = observation.effectivePeriod?.start;
      const lastDate = observation.effectivePeriod?.end;

      acc.push({
        display,
        code: getSpecificCode(observation.code?.coding ?? [], [
          ICD_10_CODE,
          SNOMED_CODE,
          LOINC_CODE,
        ]),
        value,
        firstDate: firstDate ? formatDateForDisplay(firstDate) : observationDate,
        lastDate: lastDate ? formatDateForDisplay(lastDate) : observationDate,
      });

      return acc;
    }, [] as RenderObservation[])
    .filter(observation => isWithinLastTwoYears(observation.firstDate));

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
      <tbody><tr><td>No structured observation info found in health information exchange</td></tr></tbody>        </table>
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
      getValidCode(observation.valueCodeableConcept.coding)[0]?.display
    );
  } else {
    return "";
  }
}

function createObservationVitalsSection(observations: Observation[]) {
  if (!observations) {
    return "";
  }

  const observationsSortedByDate = observations.sort((a, b) =>
    sortDate(a.effectiveDateTime, b.effectiveDateTime)
  );
  const removeDuplicate = uniqWith(observationsSortedByDate, (a, b) => {
    const aDate = buildDayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = buildDayjs(b.effectiveDateTime).format(ISO_DATE);
    const aText = a.code?.text;
    const bText = b.code?.text;
    if (aText === undefined || bText === undefined) {
      return false;
    }
    return aDate === bDate && aText === bText;
  }).filter(observation => {
    const observationDate = observation.effectiveDateTime ?? "";
    const observationDateFormatted = buildDayjs(observationDate);
    const twoYearAgo = buildDayjs().subtract(2, "year");

    return observationDateFormatted.isAfter(twoYearAgo);
  });

  const observationTableContents =
    removeDuplicate.length > 0
      ? createVitalsByDate(removeDuplicate)
      : `        <table>
      <tbody><tr><td>No structured observation info found in health information exchange</td></tr></tbody>        </table>
      `;

  return createSection("Vitals", observationTableContents);
}

function createVitalsByDate(observations: Observation[]): string {
  const orderedObservations = sortObservationsForDisplay(observations);
  const filteredObservations = filterObservationsByDate(orderedObservations);

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
              <td>${
                getValidCode(observation.code?.coding)[0]?.display ?? observation.code?.text ?? ""
              }</td>
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

function createObservationLaboratorySection(observations: Observation[]) {
  if (!observations) {
    return "";
  }

  const observationsSortedByDate = observations.sort((a, b) =>
    sortDate(a.effectiveDateTime, b.effectiveDateTime)
  );

  const removeDuplicate = uniqWith(observationsSortedByDate, (a, b) => {
    const aDate = buildDayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = buildDayjs(b.effectiveDateTime).format(ISO_DATE);
    const aText = a.code?.text;
    const bText = b.code?.text;
    if (aText === undefined || bText === undefined) {
      return false;
    }
    return aDate === bDate && aText === bText;
  }).filter(observation => {
    const observationDate = observation.effectiveDateTime ?? "";
    const observationDateFormatted = buildDayjs(observationDate);
    const twoYearAgo = buildDayjs().subtract(2, "year");

    return observationDateFormatted.isAfter(twoYearAgo);
  });

  const observationTableContents =
    removeDuplicate.length > 0
      ? createObservationsByDate(removeDuplicate)
      : `        <table>
      <tbody><tr><td>No structured laboratory info found in health information exchange</td></tr></tbody>        <table>
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
              if (coding.code !== UNK_CODE && coding.display !== UNKNOWN_DISPLAY) {
                return coding.display;
              }
              return;
            });

            const observationCodeText =
              observation.code?.text && observation.code?.text !== UNKNOWN_DISPLAY
                ? observation.code?.text
                : undefined;

            const hasDisplayValue = observationDisplay?.display ?? observationCodeText;

            return !!hasDisplayValue;
          })
          .map(observation => {
            const code = getSpecificCode(observation.code?.coding ?? [], [SNOMED_CODE, LOINC_CODE]);
            const blacklistReferenceRange = blacklistReferenceRangeText.find(referenceRange => {
              return observation.referenceRange?.[0]?.text?.toLowerCase().includes(referenceRange);
            });

            const constructedReferenceRange = blacklistReferenceRange
              ? ""
              : `${observation.referenceRange?.[0]?.low?.value ?? ""} ${
                  observation.referenceRange?.[0]?.low?.unit ?? ""
                } - ${observation.referenceRange?.[0]?.high?.value ?? ""} ${
                  observation.referenceRange?.[0]?.high?.unit ?? ""
                }`;

            const observationDisplay = observation.code?.coding?.find(coding => {
              if (coding.code !== UNK_CODE && coding.display !== UNKNOWN_DISPLAY) {
                return coding.display;
              }
              return;
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

function createImmunizationSection(immunizations: Immunization[]) {
  if (!immunizations) {
    return "";
  }

  const immunizationsSortedByDate = immunizations.sort((a, b) =>
    sortDate(a.occurrenceDateTime, b.occurrenceDateTime)
  );
  const removeDuplicate = uniqWith(immunizationsSortedByDate, (a, b) => {
    const aDate = buildDayjs(a.occurrenceDateTime).format(ISO_DATE);
    const bDate = buildDayjs(b.occurrenceDateTime).format(ISO_DATE);
    return aDate === bDate && a.vaccineCode?.text === b.vaccineCode?.text;
  });

  const immunizationTableContents =
    removeDuplicate.length > 0
      ? `
      <table>

    <thead>
      <tr>
        <th style="width: 30%">Immunization</th>
        <th style="width: 23.3%">Code</th>
        <th style="width: 23.3%">Manufacturer</th>
        <th style="width: 23.3%">Date</th>
      </tr>
    </thead>
    <tbody>
      ${removeDuplicate
        .filter(observation => isWithinLastTwoYears(observation.occurrenceDateTime))
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
            </tr>
          `;
        })
        .join("")}
    </tbody>
    </table>

  `
      : `        <table>
      <tbody><tr><td>No structured immunization info found in health information exchange</td></tr></tbody>        </table>
      `;

  return createSection("Immunizations", immunizationTableContents);
}

function createFamilyHistorySection(familyMemberHistories: FamilyMemberHistory[]) {
  if (!familyMemberHistories) {
    return "";
  }

  const removeDuplicate = uniqWith(familyMemberHistories, (a, b) => {
    return (
      renderFamilyHistoryConditions(a)?.join(", ") ===
        renderFamilyHistoryConditions(b)?.join(", ") &&
      getValidCode(a.relationship?.coding)[0]?.display ===
        getValidCode(b.relationship?.coding)[0]?.display
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

          return `
            <tr>
              <td>${getValidCode(familyMemberHistory.relationship?.coding)[0]?.display ?? ""}</td>
              <td>${renderAdministrativeGender(familyMemberHistory) ?? ""}</td>
              <td>${renderFamilyHistoryConditions(familyMemberHistory)?.join(", ") ?? ""}</td>
              <td>${getDeceasedStatus(familyMemberHistory)}</td>
              <td>${code ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
    </table>

  `
      : `        <table>
      <tbody><tr><td>No structured family member history
        info found in health information exchange</td></tr></tbody>        </table>
        `;

  return createSection("Family Member History", familyMemberHistoryTableContents);
}

function renderFamilyHistoryConditions(familyMemberHistory: FamilyMemberHistory) {
  return familyMemberHistory.condition?.map(condition => {
    return condition.code?.text ?? getValidCode(condition.code?.coding)[0]?.display;
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

function mapResourceToId<ResourceType>(resources: Resource[]): Record<string, ResourceType> {
  return resources?.reduce((acc, resource) => {
    const id = resource?.id ?? "";

    return {
      ...acc,
      [id]: resource,
    };
  }, {});
}

function isDermCondition(condition: Condition): boolean {
  const code = getSpecificCode(condition.code?.coding ?? [], [ICD_10_CODE]);
  // Check if the code is in the L00-L99 range
  const isDermCode = code ? /L\d{2}(?:\.\d+)?/i.test(code) : false;
  return isDermCode;
}

function isRheumatoidCondition(condition: Condition): boolean {
  const code = getSpecificCode(condition.code?.coding ?? [], [ICD_10_CODE]);
  // Check if the code is in the M00-M99 range
  const isRheumatoidCode = code ? /M\d{2}(?:\.\d+)?/i.test(code) : false;
  return isRheumatoidCode;
}

function isAsthmaCondition(condition: Condition): boolean {
  const code = getSpecificCode(condition.code?.coding ?? [], [ICD_10_CODE]);
  // https://www.icd10data.com/ICD10CM/Codes/J00-J99/J40-J4A/J45-/J45.909
  const isAsthmaCode = code ? code.includes("J45") : false;
  return isAsthmaCode;
}

function hasClinicalRelevantData(fhirTypes: FhirTypes): boolean {
  for (const [key, value] of Object.entries(fhirTypes)) {
    const isNotRelatedPersons = key !== "relatedPersons";
    const isNotCoverages = key !== "coverages";
    const hasValue = value && Array.isArray(value) && value.length;

    if (isNotRelatedPersons && isNotCoverages && hasValue) {
      return true;
    }
  }

  return false;
}

function getValidCode(coding: Coding[] | undefined): Coding[] {
  if (!coding) return [];

  return coding.filter(coding => {
    return (
      coding.code &&
      coding.code !== UNK_CODE &&
      coding.display &&
      coding.display.toLowerCase() !== UNKNOWN_DISPLAY
    );
  });
}

type ChartData = {
  labels: string[];
  data: number[];
  min?: number;
  max?: number;
};

type ObsSummary = {
  effectiveDate: string;
  vitalsValue: string;
};

function creteBPChartSection(observations: Observation[]) {
  if (!observations) {
    return {
      section: "",
      chartSystolicData: { labels: [], data: [] },
      chartDiastolicData: { labels: [], data: [] },
    };
  }

  const systolicObservations = observations
    .filter(observation => {
      const observationDisplay = observation.code?.coding?.find(coding => {
        const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
        return code === "8480-6";
      });

      return (
        !!observationDisplay &&
        buildDayjs(observation.effectiveDateTime).isAfter(buildDayjs().subtract(2, "year"))
      );
    })
    .sort((a, b) => sortDate(a.effectiveDateTime, b.effectiveDateTime));
  const diastolicObservations = observations
    .filter(observation => {
      const observationDisplay = observation.code?.coding?.find(coding => {
        const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
        return code === "8462-4";
      });

      return (
        !!observationDisplay &&
        buildDayjs(observation.effectiveDateTime).isAfter(buildDayjs().subtract(2, "year"))
      );
    })
    .sort((a, b) => sortDate(a.effectiveDateTime, b.effectiveDateTime));

  const uniqueSystolicObservations = uniqWith(systolicObservations, (a, b) => {
    const aDate = buildDayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = buildDayjs(b.effectiveDateTime).format(ISO_DATE);
    const aText = a.code?.text;
    const bText = b.code?.text;
    if (aText === undefined || bText === undefined) {
      return false;
    }
    return aDate === bDate && aText === bText;
  });

  const uniqueDiastolicObservations = uniqWith(diastolicObservations, (a, b) => {
    const aDate = buildDayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = buildDayjs(b.effectiveDateTime).format(ISO_DATE);
    const aText = a.code?.text;
    const bText = b.code?.text;
    if (aText === undefined || bText === undefined) {
      return false;
    }
    return aDate === bDate && aText === bText;
  });

  if (uniqueSystolicObservations.length === 0 && uniqueDiastolicObservations.length === 0) {
    return {
      section: createChartSection(
        "Blood Pressure History",
        `<table><tbody><tr><td>No Blood Pressure readings found</td></tr></tbody></table>`,
        false
      ),
      chartSystolicData: { labels: [], data: [] },
      chartDiastolicData: { labels: [], data: [] },
    };
  }

  const { tableContent, chartDiastolicData, chartSystolicData } = createBPChartByDate(
    uniqueDiastolicObservations,
    uniqueSystolicObservations
  );

  return {
    section: createChartSection("Blood Pressure History", tableContent, true),
    chartSystolicData: chartSystolicData,
    chartDiastolicData: chartDiastolicData,
  };
}

function createBPChartByDate(
  diastolic: Observation[],
  systolic: Observation[]
): {
  tableContent: string;
  chartSystolicData: ChartData;
  chartDiastolicData: ChartData;
} {
  const filteredDiastolicObservations = filterObservationsByDate(diastolic);
  const filteredSystolicObservations = filterObservationsByDate(systolic);

  const observationDiastolicObjects: ObsSummary[] = filteredDiastolicObservations
    .flatMap(tables => {
      return tables.observations.map(observation => {
        const value = renderVitalsValue(observation);
        if (value) {
          return {
            effectiveDate: buildDayjs(observation.effectiveDateTime).format(ISO_DATE),
            vitalsValue: value,
          };
        }
        return [];
      });
    })
    .flat();

  const observationSystolicObjects: ObsSummary[] = filteredSystolicObservations
    .flatMap(tables => {
      return tables.observations.map(observation => {
        const value = renderVitalsValue(observation);
        if (value) {
          return {
            effectiveDate: buildDayjs(observation.effectiveDateTime).format(ISO_DATE),
            vitalsValue: value,
          };
        }
        return [];
      });
    })
    .flat();

  const combinedObjects: ObsSummary[] = observationDiastolicObjects.map(diastolic => {
    const date = buildDayjs(diastolic.effectiveDate).format(ISO_DATE);
    const systolicValue = observationSystolicObjects.find(
      observation => buildDayjs(observation.effectiveDate).format(ISO_DATE) === date
    );

    return {
      effectiveDate: diastolic.effectiveDate,
      vitalsValue: `${systolicValue?.vitalsValue} - ${diastolic.vitalsValue}`,
    };
  });

  const observationsDiastolicAscending = cloneDeep(observationDiastolicObjects).sort((a, b) =>
    sortDate(a.effectiveDate, b.effectiveDate)
  );
  const observationsSystolicAscending = cloneDeep(observationSystolicObjects).sort((a, b) =>
    sortDate(a.effectiveDate, b.effectiveDate)
  );

  const chartDiastolicData = {
    labels: observationsDiastolicAscending.map(obs => obs.effectiveDate),
    data: observationsDiastolicAscending.map(obs => parseFloat(obs.vitalsValue)),
    min: Math.floor(
      Math.min(...observationsDiastolicAscending.map(obs => parseFloat(obs.vitalsValue))) - 1
    ),
    max: Math.ceil(
      Math.max(...observationsDiastolicAscending.map(obs => parseFloat(obs.vitalsValue))) + 1
    ),
  };

  const chartSystolicData = {
    labels: observationsSystolicAscending.map(obs => obs.effectiveDate),
    data: observationsSystolicAscending.map(obs => parseFloat(obs.vitalsValue)),
    min: Math.floor(
      Math.min(...observationsSystolicAscending.map(obs => parseFloat(obs.vitalsValue))) - 1
    ),
    max: Math.ceil(
      Math.max(...observationsSystolicAscending.map(obs => parseFloat(obs.vitalsValue))) + 1
    ),
  };

  const observationRows = combinedObjects
    .map(obs => {
      return `
      <tr>
      <td>${obs.effectiveDate}</td>
      <td>${obs.vitalsValue}</td>
      </tr>
      `;
    })
    .join(" ");

  const observationTableContents = `
    <table>
    <thead>
    <tr>
    <th style="width: 50%">Date</th>
    <th style="width: 50%">Value</th>
    </tr>
    </thead>
    <tbody>
    ${observationRows}
    </tbody>
    </table>
    `;

  return { tableContent: observationTableContents, chartDiastolicData, chartSystolicData };
}

function createFromObservationVitalsSection(
  observations: Observation[],
  vitalTitle: string,
  loincCode: string
): {
  section: string;
  chartData: ChartData;
} {
  if (!observations) {
    return { section: "", chartData: { labels: [], data: [] } };
  }

  const filteredObservations = observations.filter(observation => {
    const observationDisplay = observation.code?.coding?.find(coding => {
      const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
      return code === loincCode;
    });

    return !!observationDisplay;
  });

  const observationsLast2Years = filteredObservations.filter(observation => {
    return buildDayjs(observation.effectiveDateTime).isAfter(buildDayjs().subtract(2, "year"));
  });

  const observationsSortedByDate = observationsLast2Years.sort((a, b) =>
    sortDate(a.effectiveDateTime, b.effectiveDateTime)
  );
  const removeDuplicate = uniqWith(observationsSortedByDate, (a, b) => {
    const aDate = buildDayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = buildDayjs(b.effectiveDateTime).format(ISO_DATE);
    const aText = a.code?.text;
    const bText = b.code?.text;
    if (aText === undefined || bText === undefined) {
      return false;
    }
    return aDate === bDate && aText === bText;
  });

  if (removeDuplicate.length === 0) {
    return {
      section: createChartSection(
        `${vitalTitle} History`,
        `<table><tbody><tr><td>No ${vitalTitle} readings found</td></tr></tbody></table>`,
        false
      ),
      chartData: { labels: [], data: [] },
    };
  }
  const { tableContent, chartData } = createVitalsChartByDate(removeDuplicate);

  return {
    section: createChartSection(`${vitalTitle} History`, tableContent, true),
    chartData: chartData,
  };
}

function createVitalsChartByDate(observations: Observation[]): {
  tableContent: string;
  chartData: ChartData;
} {
  const filteredObservations = filterObservationsByDate(observations);

  const observationObjects: ObsSummary[] = filteredObservations
    .flatMap(tables => {
      return tables.observations.map(observation => {
        const value = renderVitalsValue(observation);
        if (value) {
          return {
            effectiveDate: buildDayjs(observation.effectiveDateTime).format(ISO_DATE),
            vitalsValue: value,
          };
        }
        return [];
      });
    })
    .flat();

  const observationsAscending = cloneDeep(observationObjects).sort((a, b) =>
    sortDate(a.effectiveDate, b.effectiveDate)
  );

  const chartData = {
    labels: observationsAscending.map(obs => obs.effectiveDate),
    data: observationsAscending.map(obs => parseFloat(obs.vitalsValue)),
    min: Math.floor(Math.min(...observationsAscending.map(obs => parseFloat(obs.vitalsValue))) - 1),
    max: Math.ceil(Math.max(...observationsAscending.map(obs => parseFloat(obs.vitalsValue))) + 1),
  };

  const observationRows = observationObjects
    .map(obs => {
      return `
      <tr>
      <td>${obs.effectiveDate}</td>
      <td>${obs.vitalsValue}</td>
      </tr>
      `;
    })
    .join(" ");

  const observationTableContents = `
    <table>
    <thead>
    <tr>
    <th style="width: 50%">Date</th>
    <th style="width: 50%">Value</th>
    </tr>
    </thead>
    <tbody>
    ${observationRows}
    </tbody>
    </table>
    `;

  return { tableContent: observationTableContents, chartData };
}

function createChartSection(title: string, tableContents: string, contentPresent: boolean) {
  return `
      <div class="section">
        <div class="section-title">
          <h3 id="${title}" title="${title}">&#x276F; ${title}</h3>
          <a href="#mr-header">&#x25B2; Back to Top</a>
        </div>

        ${
          contentPresent
            ? `<div><canvas
              id="${camelCase(title.replace(/\s+/g, ""))}"
              style="width: 95%; height: 400px;">
              </canvas></div>`
            : ``
        }
        <div class="section-content">
            ${tableContents}
        </div>
      </div>
    `;
}

function createChartInScript({
  chartData,
  chartTitle,
  chartId,
  secondaryData,
  secondaryTitle,
}: {
  chartData: ChartData;
  chartTitle: string;
  chartId: string;
  secondaryData?: ChartData;
  secondaryTitle?: string;
}) {
  const el = `${chartTitle + "el"}`;
  const ctx = `${chartTitle + "elCtx"}`;
  const chart = `${chartTitle + "chart"}`;

  return `
    const ${el} = document.getElementById('${chartId}');

    if (${el}) {
      const ${ctx} = ${el}.getContext('2d');

      const ${chart} = new Chart(${ctx}, {
        type: 'line',
        data: {
          labels: ${JSON.stringify(chartData.labels)},
          datasets: [
              {
                label: '${chartTitle} over the last 2 years',
                data: ${JSON.stringify(chartData.data)},
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                fill: false
              }
              ${
                secondaryData
                  ? `,
                  {
                    label: '${secondaryTitle} over the last 2 years',
                    data: ${JSON.stringify(secondaryData.data)},
                    borderColor: 'rgba(192, 75, 75, 1)',
                    borderWidth: 2,
                    fill: false
                  }`
                  : ""
              }
            ]
        },
        options: {
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'month',
                tooltipFormat: 'yyyy-MM-dd'
              },
              title: {
                display: true,
                text: 'Date'
              }
            },
            y: {
              title: {
                display: true,
                text: '${chartTitle} Value'
              },
              min: ${secondaryData?.min ?? chartData.min},
              max: ${chartData.max},
            }
          },
          layout: {
            padding: {
              left: 10,
              right: 50,
              top: 10,
              bottom: 10
            }
          }
        }
      });
    }
  `;
}

function isWithinLastTwoYears(date: string | undefined): boolean {
  const twoYearsAgo = buildDayjs().subtract(2, "year").format(ISO_DATE);

  if (!date) {
    return true;
  } else if (date > twoYearsAgo) {
    return true;
  }

  return false;
}
