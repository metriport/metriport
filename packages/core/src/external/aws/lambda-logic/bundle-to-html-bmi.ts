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
import { sortObservationsForDisplay } from "@metriport/shared/medical";
import dayjs from "dayjs";
import { cloneDeep, uniqWith } from "lodash";
import { Brief } from "../../../command/ai-brief/brief";
import { fetchCodingCodeOrDisplayOrSystem } from "../../../fhir-deduplication/shared";
import {
  createBrief,
  createSection,
  formatDateForDisplay,
  ISO_DATE,
} from "./bundle-to-html-shared";

const NPI_CODE = "us-npi";
const RX_NORM_CODE = "rxnorm";
const NDC_CODE = "ndc";
const SNOMED_CODE = "snomed";
const ICD_10_CODE = "icd-10";
const MEDICARE_CODE = "medicare";
const CPT_CODE = "cpt";
const UNK_CODE = "UNK";
const UNKNOWN_DISPLAY = "unknown";

export function bundleToHtmlBmi(fhirBundle: Bundle, brief?: Brief): string {
  const {
    patient,
    practitioners,
    conditions,
    procedures,
    observationLaboratory,
    encounters,
    medications,
    medicationStatements,
    locations,
    diagnosticReports,
  } = extractFhirTypesFromBundle(fhirBundle);

  if (!patient) {
    throw new Error("No patient found in bundle");
  }

  const { hba1cSection, hba1cChartData } =
    createHba1cFromObservationVitalsSection(observationLaboratory);

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

          .rectangle {
            padding: 5px;
            border-radius: 5px;
            text-align: center;
            display: inline-block;
          }

          .grey-rectangle {
            border: 2px solid grey;
            background-color: lightgrey;
          }

          .green-rectangle {
            border: 2px solid green;
            background-color: lightgreen;
          }

          .blue-rectangle {
            border: 2px solid blue;
            background-color: lightblue;
          }

          .red-rectangle {
            border: 2px solid red;
            background-color: lightcoral;
          }

          @media print {
            #hba1c-history {
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
          ${createWeightComoborbidities(conditions, encounters, practitioners, locations)}
          ${createRelatedConditions(conditions, encounters)}
          ${createObesitySection(conditions, encounters)}
          ${createMedicationSection(medications, medicationStatements)}
          ${createGastricProceduresSection(conditions, procedures, encounters)}
          ${createObservationLaboratorySection(observationLaboratory, diagnosticReports)}
          ${hba1cSection}
        </div>
        <script>
         const ctx = document.getElementById('hba1cChart').getContext('2d');
          const hba1c = new Chart(ctx, {
            type: 'line',
            data: {
              labels: ${JSON.stringify(hba1cChartData.labels)},
              datasets: [{
                label: 'HbA1c over the last 5 years',
                data: ${JSON.stringify(hba1cChartData.data)},
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                fill: false
              }]
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
                    text: 'HbA1c Value'
                  },
                  min: ${hba1cChartData.min},
                  max: ${hba1cChartData.max},
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
        </script>
      </body>
    </html>
  `;

  return htmlPage;
}

// TODO: Use the version from "@metriport/core/external/fhir/shared/bundle.ts"
function extractFhirTypesFromBundle(bundle: Bundle): {
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
  observationMental: Observation[];
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
  const observationMental: Observation[] = [];
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
        const isMentalHealth =
          observation.category?.find(ext => ext.coding?.[0]?.code?.toLowerCase() === "survey") ||
          observation.code?.coding?.find(coding => coding.code?.toLowerCase() === "44261-6");

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
        } else if (stringifyResource && isMentalHealth) {
          observationMental.push(observation);
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
    observationMental,
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
                  <a href="#Weight-related Comorbidities">Weight-related Comorbidities</a>
                </li>
                <li>
                  <a href="#Other Related Conditions">Other Related Conditions</a>
                </li>
                <li>
                  <a href="#Diagnosis of Obesity Date">Diagnosis of Obesity Date</a>
                </li>
                <li>
                  <a href="#medications">Medications</a>
                </li>
                <li>
                  <a href="#Surgeries">Surgeries</a>
                </li>
                <li>
                <a href="#laboratory">Laboratory</a>
                </li>
                <li>
                <a href="#hba1c-history">HbA1c History</a>
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

function createHba1cFromObservationVitalsSection(observations: Observation[]): {
  hba1cSection: string;
  hba1cChartData: ChartData;
} {
  if (!observations) {
    return { hba1cSection: "", hba1cChartData: { labels: [], data: [] } };
  }

  const a1cLoincCode = "4548-4";

  const hba1cObservations = observations.filter(observation => {
    const observationDisplay = observation.code?.coding?.find(coding => {
      const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
      return code === a1cLoincCode;
    });

    return !!observationDisplay;
  });

  const observationsLast2Years = hba1cObservations.filter(observation => {
    return dayjs(observation.effectiveDateTime).isAfter(dayjs().subtract(2, "year"));
  });

  const observationsSortedByDate = observationsLast2Years.sort((a, b) => {
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

  if (removeDuplicate.length === 0) {
    return {
      hba1cSection: createHba1cSection(
        "HbA1c History",
        `<table><tbody><tr><td>No HbA1c readings found</td></tr></tbody></table>`,
        false
      ),
      hba1cChartData: { labels: [], data: [] },
    };
  }
  const { tableContent, chartData } = createVitalsByDate(removeDuplicate);

  return {
    hba1cSection: createHba1cSection("HbA1c History", tableContent, true),
    hba1cChartData: chartData,
  };
}

function createHba1cSection(title: string, tableContents: string, contentPresent: boolean) {
  return `
    <div id="${title.toLowerCase().replace(/\s+/g, "-")}" class="section">
      <div class="section-title">
        <h3 id="${title}" title="${title}">&#x276F; ${title}</h3>
        <a href="#mr-header">&#x25B2; Back to Top</a>
      </div>

      ${
        contentPresent
          ? `<div><canvas id="hba1cChart" style="width: 95%; height: 400px;"></canvas></div>`
          : ``
      }
      <div class="section-content">
          ${tableContents}
      </div>
    </div>
  `;
}

type ObsSummary = {
  effectiveDate: string;
  vitalsValue: string;
};

type ChartData = {
  labels: string[];
  data: number[];
  min?: number;
  max?: number;
};

function createVitalsByDate(observations: Observation[]): {
  tableContent: string;
  chartData: ChartData;
} {
  const orderedObservations = sortObservationsForDisplay(observations);
  const filteredObservations = filterObservationsByDate(orderedObservations);

  const observationObjects: ObsSummary[] = filteredObservations
    .flatMap(tables => {
      return tables.observations.map(observation => {
        const value = renderVitalsValue(observation);
        if (value) {
          return {
            effectiveDate: dayjs(observation.effectiveDateTime).format(ISO_DATE),
            vitalsValue: value,
          };
        }
        return [];
      });
    })
    .flat();

  const observationsAscending = cloneDeep(observationObjects).sort((a, b) => {
    return dayjs(a.effectiveDate).isBefore(dayjs(b.effectiveDate)) ? -1 : 1;
  });

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

function renderVitalsValue(observation: Observation) {
  if (observation.valueQuantity) {
    const value = observation.valueQuantity?.value;
    const unit = observation.valueQuantity?.unit?.replace(/[{()}]/g, "");

    return `${value} ${unit}`;
  } else if (observation.valueString) {
    return observation.valueString;
  }
  return undefined;
}

type RenderCondition = {
  id: string | undefined;
  code: string | null;
  name: string;
  firstSeen: string | undefined;
  lastSeen: string | undefined;
  clinicalStatus: string;
  recorderId: string | undefined;
};

const listOfConditionCodes = [
  "E11.9",
  "E66.3",
  "E10.9",
  "R73.03",
  "E88.81",
  "E28.2",
  "E78.1",
  "K76.0",
  "G47.33",
  "M16.9",
  "M17.9",
  "M19.90",
  "E78.5",
  "I10",
  "Z13.6",
  "I25.10",
  "R03.0",
  "K31.84",
  "K21.9",
  "G47.30",
  "G47.33",
  "I20.9",
  "I50.22",
  "J45.909",
  "J44.9",
  "K75.81",
  "I25.10",
  "Z68.41",
];

const listOfConditionNames = [
  "Kidney Disease",
  "Type 2 diabetes",
  "Overweight",
  "Diabetes",
  "Type 1 diabetes",
  "Prediabetes",
  "Metabolic Syndrome",
  "hypertension",
  "high blood pressure",
  "PCOS",
  "polycystic ovary syndrome",
  "High triglycerides",
  "dyslipidemia",
  "Hypertriglyceridemia",
  "NAFLD",
  "fatty liver disease",
  "OSA",
  "Obstructive Sleep Apnea",
  "Weight related osteoarthritis of hip",
  "Weight related osteoarthritis of knee",
  "osteoarthritis",
  "Hyperlipidemia",
  "High Cholesterol",
  "Cardiovascular disease",
  "Coronary heart disease",
  "Elevated blood-pressure reading, without diagnosis of hypertension",
  "Gastroparesis",
  "GERD",
  "Gastro-esophageal reflux disease",
  "Sleep apnea",
  "Angina",
  "Congestive Heart Failure",
  "Symptomatic osteoarthritis of the lower extremities",
  "asthma",
  "Chronic obstructive pulmonary disease",
  "Nonalcoholic steatohepatitis",
  "NASH",
  "Metabolic-dysfunction associated steatotic liver disease",
  "non-alcoholic fatty liver disease",
  "Atherosclerotic cardiovascular disease",
];

const matchesCode = (codingCode: string | undefined, listOfCodes: string[]): boolean =>
  !!codingCode &&
  listOfCodes.some(code => code.trim().toLowerCase() === codingCode.trim().toLowerCase());

const matchesDisplay = (codingDisplay: string | undefined, listOfNames: string[]): boolean => {
  const display = codingDisplay?.trim().toLowerCase();

  return (
    !!display &&
    listOfNames
      .map(name => name.trim().toLowerCase())
      .some(name => display.includes(name) || name.includes(display))
  );
};

const matchesText = (codeText: string | undefined, listOfNames: string[]): boolean => {
  const text = codeText?.trim().toLowerCase();
  return (
    !!text &&
    listOfNames
      .map(name => name.trim().toLowerCase())
      .some(name => text.includes(name) || name.includes(text))
  );
};

function createWeightComoborbidities(
  conditions: Condition[],
  encounters: Encounter[],
  practitioners: Practitioner[],
  locations: Location[]
) {
  if (!conditions) {
    return "";
  }

  const conditionsOfInterest = conditions.filter(condition => {
    return (
      condition.code?.coding?.some(
        coding =>
          matchesCode(coding.code, listOfConditionCodes) ||
          matchesDisplay(coding.display, listOfConditionNames)
      ) || matchesText(condition.code?.text, listOfConditionNames)
    );
  });

  const conditionDateDict = getConditionDatesFromEncounters(encounters);
  const removeDuplicate = removeDuplicateConditions(conditionsOfInterest, conditionDateDict);

  const conditionTableContents =
    removeDuplicate.length > 0
      ? `
      <table>

    <thead>
      <tr>
        <th style="width: 30%">Condition</th>
        <th style="width: 10%">Code</th>
        <th style="width: 30%">Location</th>
        <th style="width: 20%">Provider Name</th>
        <th style="width: 10%">Provider NPI</th>
      </tr>
    </thead>
    <tbody>
      ${removeDuplicate
        .map(condition => {
          const recorder = getPractitionerFromRecorderId(condition.recorderId, practitioners);
          const location = getLocationFromEncounterDiagnosis(condition.id, encounters, locations);
          return `
            <tr>
              <td>${condition.name}</td>
              <td>${condition.code ?? ""}</td>
              <td>${location?.name ?? ""}</td>
              <td>${recorder?.name ?? ""}</td>
              <td>${recorder?.npi}</td>
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

  return createSection("Weight-related Comorbidities", conditionTableContents);
}

function getLocationFromEncounterDiagnosis(
  conditionId: string | undefined,
  encounters: Encounter[],
  locations: Location[]
): Location | undefined {
  if (!conditionId) return undefined;

  const encounter = encounters.find(enc =>
    enc.diagnosis?.some(diag => diag.condition?.reference?.includes(conditionId))
  );

  if (!encounter) return undefined;

  const locationReference = encounter.location?.[0]?.location?.reference;
  if (!locationReference) return undefined;

  const locationId = locationReference.split("/")[1];

  return locations.find(location => location.id === locationId);
}

function getPractitionerFromRecorderId(
  recorderId: string | undefined,
  practitioners: Practitioner[]
):
  | {
      name: string;
      npi: string;
    }
  | undefined {
  if (!recorderId) return undefined;

  const practitioner = practitioners.find(practitioner => practitioner.id === recorderId);

  if (!practitioner) return undefined;

  const npi = practitioner.identifier?.find(id => id.system?.includes(NPI_CODE));

  const practitionerName = practitioner.name?.[0];

  return {
    name: `${practitionerName?.given?.[0] ?? ""} ${practitionerName?.family ?? ""}${
      practitionerName?.suffix?.[0] ? `, ${practitionerName?.suffix?.[0]}` : ""
    }`,
    npi: npi?.value ?? "",
  };
}

const listOfRelatedCodes = [
  "R36.9",
  "G40.909",
  "H40.9",
  "F11.10",
  "F11.20",
  "F11.90",
  "C73",
  "E31.22",
  "E31.23",
  "K85.9",
  "K86.1",
  "F10.20",
  "F10.10",
  "F50.81",
  "F50.2",
  "F50.82",
  "F50.89",
];

const listOfRelatedNames = [
  "Glaucoma",
  "Seizures",
  "Opioid Abuse, dependence, use",
  "Medullary Thyroid Cancer",
  "Multiple endocrine neoplasia",
  "Acute Pancreatitis, unspecified",
  "Chronic pancreatitis",
  "Alcohol dependence, uncomplicated",
  "Alcohol abuse, uncomplicated",
  "Binge eating disorder",
  "Bulimia nervosa",
  "Avoidant/restrictive food intake disorder",
  "Other specified eating disorder",
  "night eating syndrome",
];
function createRelatedConditions(conditions: Condition[], encounter: Encounter[]) {
  if (!conditions) {
    return "";
  }

  const conditionsOfInterest = conditions.filter(condition => {
    return (
      condition.code?.coding?.some(
        coding =>
          matchesCode(coding.code, listOfRelatedCodes) ||
          matchesDisplay(coding.display, listOfRelatedNames)
      ) || matchesText(condition.code?.text, listOfRelatedNames)
    );
  });

  const conditionDateDict = getConditionDatesFromEncounters(encounter);
  const removeDuplicate = removeDuplicateConditions(conditionsOfInterest, conditionDateDict);

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
            <tr>
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
      <tbody><tr><td>No condition info found</td></tr></tbody>        </table>
      `;

  return createSection("Other Related Conditions", conditionTableContents);
}

const listOfObesityCodes = ["E66.01", "E66.9"];
const listOfObesityNames = ["obesity"];

function createObesitySection(conditions: Condition[], encounter: Encounter[]) {
  if (!conditions) {
    return "";
  }

  const obesityConditions = conditions.filter(condition => {
    return (
      condition.code?.coding?.some(
        coding =>
          matchesCode(coding.code, listOfObesityCodes) ||
          matchesDisplay(coding.display, listOfObesityNames)
      ) || matchesText(condition.code?.text, listOfObesityNames)
    );
  });

  const conditionDateDict = getConditionDatesFromEncounters(encounter);
  const removeDuplicate = removeDuplicateConditions(obesityConditions, conditionDateDict);

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

  return createSection("Diagnosis of Obesity Date", conditionTableContents);
}

function removeDuplicateConditions(
  conditions: Condition[],
  conditionDateDict: Record<
    string,
    {
      start: string;
      end: string;
    }
  >
): RenderCondition[] {
  return uniqWith(conditions, (a, b) => {
    const aText = a.code?.text;
    const bText = b.code?.text;

    if (aText == undefined || bText == undefined) {
      return false;
    }

    const aDate = dayjs(a.onsetDateTime).format(ISO_DATE);
    const bDate = dayjs(b.onsetDateTime).format(ISO_DATE);

    return aDate === bDate && aText === bText;
  })
    .filter(condition => {
      const snomedCode = condition.code?.coding?.find(coding =>
        coding.system?.toLowerCase().includes(SNOMED_CODE)
      )?.code;
      const genericSnomedProblemCode = "55607006";
      const blacklistCodes = [genericSnomedProblemCode];
      return !blacklistCodes.includes(snomedCode ?? "");
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

      const recorderId = condition.recorder?.reference?.split("/")[1];

      const newCondition: RenderCondition = {
        id: condition.id,
        code: codeName,
        name,
        firstSeen: onsetStartTime && onsetStartTime.length ? onsetStartTime : onsetDateTime,
        lastSeen: onsetEndTime && onsetEndTime.length ? onsetEndTime : onsetDateTime,
        clinicalStatus,
        recorderId,
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
}

function createMedicationSection(
  medications: Medication[],
  medicationStatements: MedicationStatement[]
) {
  if (!medicationStatements) {
    return "";
  }

  const mappedMedications = mapResourceToId<Medication>(medications);

  const recentMedications = medicationStatements.filter(medicationStatement => {
    return (
      dayjs(medicationStatement.effectivePeriod?.start).isAfter(dayjs().subtract(4, "months")) ||
      !medicationStatement.effectivePeriod
    );
  });

  const medicationsSortedByDate = recentMedications.sort((a, b) => {
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

  const activeMedicationsSection = createSectionInMedications(
    mappedMedications,
    activeMedications,
    "Active Medications"
  );

  const medicalTableContents = `
  ${activeMedicationsSection}
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
    const noMedFound = "No medication info found";
    return ` <h4>${title}</h4><table><tbody><tr><td>${noMedFound}</td></tr></tbody></table>`;
  }
  const medicationStatementsSortedByDate = medicationStatements.sort((a, b) => {
    const aDate = getDateFormMedicationStatement(a);
    const bDate = getDateFormMedicationStatement(b);
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
            <tr data-id="${medicationStatement.id}">
              <td>${medication?.code?.text ?? ""}</td>
              <td>${blacklistedInstruction ? "" : medicationStatement.dosage?.[0]?.text ?? ""}</td>
              <td>${medicationStatement.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.value ?? ""} ${
            medicationStatement.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit?.replace(
              /[{()}]/g,
              ""
            ) ?? ""
          }</td>
              <td>${medicationStatement.status ?? ""}</td>
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

const listOfSurgeryCodes = [
  "LG39287-4",
  "43847",
  "43644",
  "47562",
  "43846",
  "43846",
  "43775",
  "43770",
  "43845",
  "43235",
  "43270",
  "43842",
  "43999",
  "43843",
  "0DBA0ZZ",
  "0D5B0ZZ",
  "0D5A0ZZ",
  "0D5S0ZZ",
  "0D5R0ZZ",
  "0D5F0ZZ",
  "0DBD0ZZ",
  "0FT44ZZ",
  "0FT40ZZ",
  "0FC44ZZ",
  "02703ZZ",
  "027134Z",
  "02713ZZ",
  "027034Z",
  "02703DZ",
  "02713DZ",
  "02C83ZZ",
  "02C93ZZ",
  "04V03DZ",
  "04V03ZZ",
  "047K3DZ",
];

const listOfSurgeryNames = [
  "Gastric Bypass",
  "Bariatric Surgery",
  "Cholecystectomy",
  "Roux-en-Y Gastric Bypass",
  "RYGB",
  "Sleeve Gastrectomy",
  "Adjustable Gastric Banding",
  "Intragastric Balloon",
  "Gastric Balloon",
  "Vertical Banded Gastroplasty",
  "Endoscopic Sleeve Gastroplasty",
  "Mini Gastric Bypass",
  "Gastric Bypass",
  "Adjustable Gastric Band",
  "Biliopancreatic Diversion with Duodenal Switch",
  "Endoscopic Intragastric Balloon Placement",
  "Revision of Bariatric Surgery",
  "Gastric bypass, laparoscopic approach",
  "Gastric bypass, open approach",
  "Insertion of adjustable gastric band, laparoscopic approach",
  "Insertion of adjustable gastric band, open approach",
  "Biliopancreatic diversion (BPD) with duodenal switch, open approach",
  "Sleeve gastrectomy component of BPD/DS, laparoscopic approach",
  "Insertion of intragastric balloon, endoscopic approach",
  "Revision of gastric bypass, laparoscopic approach",
  "Laparoscopic Cholecystectomy",
  "Open Cholecystectomy",
  "Laparoscopic Cholecystectomy with Exploration of Common Bile Duct (if done)",
  "Dilation of coronary artery",
  "Extirpation of matter from coronary artery",
  "Dilation of femoral artery",
  "Dilation of iliac artery",
  "Coronary Stenting",
  "Balloon Angioplasty",
  "Percutaneous Transluminal Coronary Angioplasty",
  "Atherectomy or thrombectomy",
  "Stenting of Peripheral Arteries",
];

function createGastricProceduresSection(
  conditions: Condition[],
  procedures: Procedure[],
  encounter: Encounter[]
) {
  if (!procedures && !conditions) {
    return "";
  }

  const surgeryConditions = conditions.filter(condition => {
    return (
      condition.code?.coding?.some(
        coding =>
          matchesCode(coding.code, listOfSurgeryCodes) ||
          matchesDisplay(coding.display, listOfSurgeryNames)
      ) || matchesText(condition.code?.text, listOfSurgeryNames)
    );
  });

  const conditionDateDict = getConditionDatesFromEncounters(encounter);
  const noDuplicateConditions = removeDuplicateConditions(surgeryConditions, conditionDateDict);

  const surgeries = procedures.filter(procedure => {
    return (
      procedure.code?.coding?.some(
        coding =>
          matchesCode(coding.code, listOfSurgeryCodes) ||
          matchesDisplay(coding.display, listOfSurgeryNames)
      ) || matchesText(procedure.code?.text, listOfSurgeryNames)
    );
  });

  const proceduresSortedByDate = surgeries.sort((a, b) => {
    return dayjs(a.performedDateTime).isBefore(dayjs(b.performedDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(proceduresSortedByDate, (a, b) => {
    const aDate = dayjs(a.performedDateTime).format(ISO_DATE);
    const bDate = dayjs(b.performedDateTime).format(ISO_DATE);
    return aDate === bDate && a?.text === b?.text;
  });

  const procedureTableContents =
    removeDuplicate.length > 0 || noDuplicateConditions.length > 0
      ? `
      <table>

    <thead>
      <tr>
        <th style="width: 40%">Procedure</th>
        <th style="width: 20%">Code</th>
        <th style="width: 20%">Date</th>
        <th style="width: 20%">Status</th>
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

          return `
            <tr>
              <td>${procedure?.code?.text ?? ""}</td>
              <td>${code ?? ""}</td>
              <td>${
                (procedure.performedDateTime &&
                  formatDateForDisplay(procedure.performedDateTime)) ||
                (procedure.performedPeriod &&
                  formatDateForDisplay(procedure.performedPeriod?.start))
              } </td>
              <td>${procedure.status ?? ""}</td>
            </tr>
          `;
        })
        .join("")}

        ${noDuplicateConditions
          .map(condition => {
            return `
              <tr>
                <td>${condition.name ?? ""}</td>
                <td>${condition.code ?? ""}</td>
                <td>${formatDateForDisplay(condition.firstSeen)}</td>
                <td>${condition.clinicalStatus ?? ""}</td>
              </tr>
            `;
          })
          .join("")}
    </tbody>
    </table>

  `
      : `        <table>
      <tbody><tr><td>No surgiers info found</td></tr></tbody>        </table>
      `;

  return createSection("Surgeries", procedureTableContents);
}

function createObservationLaboratorySection(
  observations: Observation[],
  diagnosticReports: DiagnosticReport[]
) {
  if (!observations || !diagnosticReports) {
    return createSection(
      "Laboratory",
      `<table><tbody><tr><td>No laboratory info found</td></tr></tbody></table>`
    );
  }

  const basicMetabolicPanels = findMetabolicPanels(diagnosticReports, "Basic Metabolic Panel");
  const comprehensiveMetabolicPanels = findMetabolicPanels(
    diagnosticReports,
    "Comprehensive Metabolic Panel"
  );
  const lipidPanels = findMetabolicPanels(diagnosticReports, "Lipid Panel");
  const thyroidPanels = findMetabolicPanels(diagnosticReports, "Thyroid");
  const cbcPanels = findMetabolicPanels(diagnosticReports, "Complete Blood Count");

  const latestBasicPanels = basicMetabolicPanels.slice(0, 2);
  const latestComprehensivePanels = comprehensiveMetabolicPanels.slice(0, 2);
  const latestLipidPanels = lipidPanels.slice(0, 2);
  const latestThyroidPanels = thyroidPanels.slice(0, 2);
  const latestCbcPanels = cbcPanels.slice(0, 2);

  const includedPanels = new Set([
    ...latestBasicPanels,
    ...latestComprehensivePanels,
    ...latestLipidPanels,
    ...latestThyroidPanels,
    ...latestCbcPanels,
  ]);

  const hba1cPanels = findPanelsWithHba1c(diagnosticReports, observations, includedPanels);
  const latestHba1cPanels = hba1cPanels.slice(0, 2);

  const allPanels = [
    ...latestBasicPanels.map(p => ({ type: "Basic Metabolic Panel", panel: p })),
    ...latestComprehensivePanels.map(p => ({ type: "Comprehensive Metabolic Panel", panel: p })),
    ...latestLipidPanels.map(p => ({ type: "Lipid Panel", panel: p })),
    ...latestThyroidPanels.map(p => ({ type: "Thyroid", panel: p })),
    ...latestCbcPanels.map(p => ({ type: "Complete Blood Count", panel: p })),
    ...latestHba1cPanels.map(p => ({ type: "HbA1c Panel", panel: p })),
  ]
    .sort((a, b) => {
      const dateA = a.panel.effectiveDateTime || a.panel.effectivePeriod?.start || "";
      const dateB = b.panel.effectiveDateTime || b.panel.effectivePeriod?.start || "";
      return dayjs(dateB).diff(dayjs(dateA));
    })
    .slice(0, 4);

  const noPanelsFound = allPanels.length === 0;

  const panelContent = noPanelsFound
    ? `<div><h4>Lab Panels</h4><table><tbody><tr><td>No lab panels found</td></tr></tbody></table></div>`
    : allPanels.map(({ type, panel }) => createPanelSection(type, [panel], observations)).join("");

  return createSection("Laboratory", `${panelContent}`);
}

function findPanelsWithHba1c(
  diagnosticReports: DiagnosticReport[],
  allObservations: Observation[],
  excludedPanels: Set<DiagnosticReport>
): DiagnosticReport[] {
  const a1cLoincCode = "4548-4";

  return diagnosticReports
    .filter(report => !excludedPanels.has(report))
    .filter(report => {
      if (!report.result) return false;

      return report.result.some(reference => {
        const observationId = reference.reference?.split("/")[1];
        const observation = allObservations.find(obs => obs.id === observationId);

        return observation?.code?.coding?.some(coding => {
          const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
          return code === a1cLoincCode;
        });
      });
    })
    .sort((a, b) => {
      const dateA = a.effectiveDateTime || a.effectivePeriod?.start || "";
      const dateB = b.effectiveDateTime || b.effectivePeriod?.start || "";
      return dayjs(dateB).diff(dayjs(dateA));
    });
}

function findMetabolicPanels(
  diagnosticReports: DiagnosticReport[],
  panelType: string
): DiagnosticReport[] {
  const matchingReports = diagnosticReports.filter(report => {
    if (report.code?.text?.toLowerCase().includes(panelType.toLowerCase())) return true;

    return report.code?.coding?.some(coding =>
      coding.display?.toLowerCase().includes(panelType.toLowerCase())
    );
  });

  return matchingReports.sort((a, b) => {
    const dateA = a.effectiveDateTime || a.effectivePeriod?.start || a.effectivePeriod?.end || "";
    const dateB = b.effectiveDateTime || b.effectivePeriod?.start || b.effectivePeriod?.end || "";
    return dayjs(dateB).diff(dayjs(dateA));
  });
}

function createPanelSection(
  panelType: string,
  panels: DiagnosticReport[],
  allObservations: Observation[]
): string {
  if (panels.length === 0) return "";

  return panels
    .map(panel => {
      const panelDate = formatDateForDisplay(
        panel.effectiveDateTime ?? panel.effectivePeriod?.start
      );
      const panelObservations = getPanelObservations(panel, allObservations);

      if (panelObservations.length === 0) return "";

      return `
      <div>
        <h4>${panelType} Results On: ${panelDate}</h4>
        ${createObservationTable(panelObservations)}
      </div>
    `;
    })
    .join("");
}

function getPanelObservations(
  panel: DiagnosticReport,
  allObservations: Observation[]
): Observation[] {
  if (!panel.result || panel.result.length === 0) return [];

  const observationResults: Observation[] = [];

  panel.result.forEach(reference => {
    const observationId = reference.reference?.split("/")[1];
    const observation = allObservations.find(obs => obs.id === observationId);
    if (observation) {
      observationResults.push(observation);
    }
  });

  return observationResults;
}

function createObservationTable(observations: Observation[]): string {
  const blacklistReferenceRangeText = ["unknown", "not detected"];

  const numericObservations = observations.filter(observation => {
    if (typeof observation.valueQuantity?.value === "number") {
      return true;
    }

    if (observation.valueString) {
      const parsedValue = parseFloat(observation.valueString);
      return !isNaN(parsedValue);
    }

    return false;
  });

  if (numericObservations.length === 0) {
    return "<table><tbody><tr><td>No numeric lab values found</td></tr></tbody></table>";
  }

  return `
    <table>
      <thead>
        <tr>
          <th style="width: 25%">Observation</th>
          <th style="width: 25%">Value</th>
          <th style="width: 25%">Interpretation</th>
          <th style="width: 25%">Reference Range</th>
        </tr>
      </thead>
      <tbody>
        ${numericObservations
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

            const classCodes = getClassFromLaboratory(observation);
            const observationDisplay = observation.code?.coding?.find(coding => {
              if (coding.code !== UNK_CODE && coding.display !== UNKNOWN_DISPLAY) {
                return coding.display;
              }
              return;
            });

            return `
              <tr>
                <td>${observationDisplay?.display ?? observation.code?.text ?? ""}</td>
                <td class="${classCodes}">${
              observation.valueQuantity?.value ?? observation.valueString ?? ""
            }</td>
                <td>${observation.interpretation?.[0]?.text ?? ""}</td>
                <td>${
                  blacklistReferenceRange
                    ? ""
                    : observation.referenceRange?.[0]?.text ?? constructedReferenceRange ?? ""
                }</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function getClassFromLaboratory(obs: Observation) {
  const interpretation = getInterpretation(obs);
  switch (interpretation) {
    case "noref":
      return "rectangle grey-rectangle";
    case "low":
      return "rectangle blue-rectangle";
    case "normal":
      return "rectangle green-rectangle";
    case "high":
      return "rectangle red-rectangle";
    case "unknown":
      return "";
  }
}

function getInterpretation(obs: Observation) {
  const interpretation = obs.interpretation?.[0]?.text?.toLowerCase() ?? undefined;
  switch (interpretation) {
    case "low":
      return "low";
    case "high":
      return "high";
    case "abnormal":
      return "high";
    case "normal":
      return "normal";
    case "negative":
      return "normal";
  }

  const valueString = obs.valueQuantity?.value ?? obs.valueString;
  const value = typeof valueString === "number" ? valueString : parseFloat(valueString ?? "");
  if (isNaN(value)) {
    const formattedValue = typeof valueString === "string" && valueString?.toLowerCase().trim();
    switch (formattedValue) {
      case "normal":
        return "normal";
      case "abnormal":
        return "high";
      case "negative":
        return "normal";
      default:
        return "unknown";
    }
  }

  if (!value) return "unknown";
  const lowRef = obs.referenceRange?.[0]?.low?.value;
  const highRef = obs.referenceRange?.[0]?.high?.value;

  if (lowRef && value < lowRef) {
    return "low";
  }

  if (highRef && value > highRef) {
    return "high";
  }

  if (!lowRef && !highRef) {
    return "noref";
  }
  return "normal";
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

function getSpecificCode(coding: Coding[], systemsList: string[]): string | null {
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
