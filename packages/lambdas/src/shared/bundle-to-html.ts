import {
  Bundle,
  MedicationRequest,
  Patient,
  Condition,
  AllergyIntolerance,
  Coding,
  Procedure,
  Observation,
  Encounter,
  Immunization,
  FamilyMemberHistory,
  RelatedPerson,
  Task,
  Coverage,
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

export const bundleToHtml = (json: string): string => {
  const fhirBundle: Bundle = JSON.parse(json);
  const {
    patient,
    medications,
    conditions,
    allergies,
    procedures,
    observationOther,
    observationSocialHistory,
    observationVitals,
    observationLaboratory,
    encounters,
    immunizations,
    familyMemberHistories,
    relatedPersons,
    tasks,
    coverages,
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
            padding: 20px 40px;
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
          }

          #nav li a {
            text-decoration: none;
            color: black;
          }

        </style>
      </head>

      <body>
        ${createMRHeader(patient)}
        <div class="divider"></div>
        <div id="mr-sections">
          ${createMedicationSection(medications)}
          ${createConditionSection(conditions)}
          ${createAllergySection(allergies)}
          ${createProcedureSection(procedures)}
          ${createObservationSocialHistorySection(observationSocialHistory)}
          ${createObservationVitalsSection(observationVitals)}
          ${createObservationLaboratorySection(observationLaboratory)}
          ${createOtherObservationsSection(observationOther)}
          ${createEncountersSection(encounters)}
          ${createImmunizationSection(immunizations)}
          ${createFamilyHistorySection(familyMemberHistories)}
          ${createRelatedPersonSection(relatedPersons)}
          ${createTaskSection(tasks)}
          ${createCoverageSection(coverages)}
        </div>
        <div id="mr-footer"></div>
      </body>
    </html>
  `;

  return htmlPage;
};

function extractFhirTypesFromBundle(bundle: Bundle): {
  patient?: Patient;
  medications: MedicationRequest[];
  conditions: Condition[];
  allergies: AllergyIntolerance[];
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
} {
  let patient: Patient | undefined;
  const medications: MedicationRequest[] = [];
  const conditions: Condition[] = [];
  const allergies: AllergyIntolerance[] = [];
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

  if (bundle.entry) {
    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (resource?.resourceType === "Patient") {
        patient = resource as Patient;
      } else if (resource?.resourceType === "MedicationRequest") {
        medications.push(resource as MedicationRequest);
      } else if (resource?.resourceType === "Condition") {
        conditions.push(resource as Condition);
      } else if (resource?.resourceType === "AllergyIntolerance") {
        allergies.push(resource as AllergyIntolerance);
      } else if (resource?.resourceType === "Procedure") {
        procedures.push(resource as Procedure);
      } else if (resource?.resourceType === "Observation") {
        const observation = resource as Observation;
        const isVitalSigns = observation.extension?.find(
          ext => ext.valueCodeableConcept?.coding?.[0]?.code?.toLowerCase() === "ccd vitals"
        );
        const isSocialHistory = observation.extension?.find(
          ext => ext.valueCodeableConcept?.coding?.[0]?.code?.toLowerCase() === "ccd social history"
        );
        const isLaboratory = observation.category?.find(
          category => category.text?.toLowerCase() === "laboratory"
        );
        const stringifyResource = JSON.stringify(resource);

        if (stringifyResource && isVitalSigns) {
          observationVitals.push(observation);
        } else if (stringifyResource && isLaboratory) {
          observationLaboratory.push(observation);
        } else if (
          stringifyResource &&
          isSocialHistory
        ) {
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
      }
    }
  }

  return {
    patient,
    medications,
    conditions,
    allergies,
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
  };
}

function createMRHeader(patient: Patient) {
  return `
    <div id="mr-header">
      <div class='logo-container'>
        <img src="metriport-logo.png" alt="Logo">
      </div>
      <h1 class="title">
        Medical Record Document (${dayjs().format(ISO_DATE)})
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
                ${createHeaderTableRow("Id", patient.id ?? "")}
                ${createHeaderTableRow("DOB", patient.birthDate ?? "")}
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
              <li>
                <a href="#social-history">Social History</a>
              </li>
              <li>
                <a href="#vitals">Vitals</a>
              </li>
              <li>
                <a href="#laboratory">Laboratory</a>
              </li>
            </div>
            <div class='half'>
              <li>
                <a href="#other-observations">Other Observations</a>
              </li>
              <li>
                <a href="#encounters">Encounters</a>
              </li>
              <li>
                <a href="#immunizations">Immunizations</a>
              </li>
              <li>
                <a href="#family-member-history">Family Member History</a>
              </li>
              <li>
                <a href="#related-persons">Related Persons</a>
              </li>
              <li>
                <a href="#tasks">Tasks</a>
              </li>
              <li>
                <a href="#coverage">Coverage</a>
              </li>
            </div>
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

function createMedicationSection(medicationRequests: MedicationRequest[]) {
  if (!medicationRequests) {
    return "";
  }

  const medicationsSortedByDate = medicationRequests.sort((a, b) => {
    return dayjs(a.authoredOn).isBefore(dayjs(b.authoredOn)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(medicationsSortedByDate, (a, b) => {
    const aDate = dayjs(a.authoredOn).format(ISO_DATE);
    const bDate = dayjs(b.authoredOn).format(ISO_DATE);

    return (
      aDate === bDate && a.medicationCodeableConcept?.text === b.medicationCodeableConcept?.text
    );
  });

  const blacklistInstructions = ["not defined"];

  const medicalTableContents = `
    <thead>
      <tr>
        <th style="width: 25%">Medication</th>
        <th style="width: 25%">Instructions</th>
        <div style="width: 50%">
          <th>Dosage</th>
          <th>Quantity</th>
          <th>Refills</th>
          <th>Status</th>
          <th>Code</th>
          <th>Date</th>
        </div>
      </tr>
    </thead>
    <tbody>
      ${removeDuplicate
        .map(medicationRequest => {
          const code = getSpecificCode(medicationRequest.medicationCodeableConcept?.coding ?? [], [
            RX_NORM_CODE,
            NDC_CODE,
          ]);

          const blacklistedInstruction = blacklistInstructions.find(instruction => {
            return medicationRequest.dosageInstruction?.[0]?.text
              ?.toLowerCase()
              .includes(instruction);
          });

          return `
            <tr>
              <td>${medicationRequest.medicationCodeableConcept?.text ?? ""}</td>
              <td>${
                blacklistedInstruction ? "" : medicationRequest.dosageInstruction?.[0]?.text ?? ""
              }</td>
              <td>${
                medicationRequest.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseRange?.low?.value ??
                ""
              } ${
            medicationRequest.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseRange?.low?.unit?.replace(
              /[{()}]/g,
              ""
            ) ?? ""
          }</td>
              <td>${medicationRequest.dispenseRequest?.quantity?.value ?? ""}</td>
              <td>${medicationRequest.dispenseRequest?.numberOfRepeatsAllowed ?? ""}</td>
              <td>${medicationRequest.status ?? ""}</td>
              <td>${code ?? ""}</td>
              <td>${dayjs(medicationRequest.authoredOn).format(ISO_DATE) ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;

  return createSection("Medications", medicalTableContents);
}

function createConditionSection(conditions: Condition[]) {
  if (!conditions) {
    return "";
  }

  const conditionsSortedByDate = conditions.sort((a, b) => {
    return dayjs(a.onsetDateTime).isBefore(dayjs(b.onsetDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(conditionsSortedByDate, (a, b) => {
    const aDate = dayjs(a.onsetDateTime).format(ISO_DATE);
    const bDate = dayjs(b.onsetDateTime).format(ISO_DATE);
    return aDate === bDate && a.code?.text === b.code?.text;
  });

  const conditionTableContents = `
    <thead>
      <tr>
        <th style="width: 50%">Condition</th>
        <th style="width: 16%">Code</th>
        <th style="width: 16%">Date</th>
        <th style="width: 16%">Status</th>
      </tr>
    </thead>
    <tbody>
      ${removeDuplicate
        .map(condition => {
          const code = getSpecificCode(condition.code?.coding ?? [], [ICD_10_CODE, SNOMED_CODE]);

          return `
            <tr>
              <td>${condition.code?.text ?? ""}</td>
              <td>${code ?? ""}</td>
              <td>${dayjs(condition.onsetDateTime).format(ISO_DATE) ?? ""}</td>
              <td>${condition.clinicalStatus?.coding?.[0]?.code ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;

  return createSection("Conditions", conditionTableContents);
}

function createAllergySection(allergies: AllergyIntolerance[]) {
  if (!allergies) {
    return "";
  }

  const allergiesSortedByDate = allergies.sort((a, b) => {
    return dayjs(a.onsetDateTime).isBefore(dayjs(b.onsetDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(allergiesSortedByDate, (a, b) => {
    const aDate = dayjs(a.onsetDateTime).format(ISO_DATE);
    const bDate = dayjs(b.onsetDateTime).format(ISO_DATE);
    return aDate === bDate && a.code?.text === b.code?.text;
  });

  const blacklistCodeText = ["no known allergies"];
  const blacklistManifestationText = ["info not available", "other"];

  const filterBlacklistText = removeDuplicate.filter(allergy => {
    const codeText = allergy.code?.text?.toLowerCase();

    return codeText && !blacklistCodeText.includes(codeText);
  });

  const allergyTableContents =
    filterBlacklistText.length > 0
      ? `
    <thead>
      <tr>
        <th style="width: 30%">Allergy</th>
        <th style="width: 17.5%">Manifestation</th>
        <th style="width: 17.5%">Code</th>
        <th style="width: 17.5%">Date</th>
        <th style="width: 17.5%">Status</th>
      </tr>
    </thead>
    <tbody>
      ${filterBlacklistText
        .map(allergy => {
          const code = getSpecificCode(allergy.code?.coding ?? [], [SNOMED_CODE, ICD_10_CODE]);

          const blacklistManifestation = blacklistManifestationText.find(manifestation => {
            return allergy.reaction?.[0]?.manifestation?.[0]?.text
              ?.toLowerCase()
              .includes(manifestation);
          });

          return `
            <tr>
              <td>${allergy.code?.text ?? ""}</td>
              <td>${
                blacklistManifestation ? "" : allergy.reaction?.[0]?.manifestation?.[0]?.text ?? ""
              }</td>
              <td>${code ?? ""}</td>
              <td>${dayjs(allergy.onsetDateTime).format(ISO_DATE) ?? ""}</td>
              <td>${allergy.clinicalStatus?.coding?.[0]?.code ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No allergy info found</td></tr></tbody>`;

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
    return aDate === bDate && a.code?.text === b.code?.text;
  });

  const procedureTableContents =
    removeDuplicate.length > 0
      ? `
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
          const code = getSpecificCode(procedure.code?.coding ?? [], [SNOMED_CODE, MEDICARE_CODE]);

          // TODO: ADD PERFORMER FROM PRACTITIONER
          return `
            <tr>
              <td>${procedure.code?.text ?? ""}</td>
              <td>${code ?? ""}</td>
              <td>${dayjs(procedure.performedDateTime).format(ISO_DATE) ?? ""}</td>
              <td>${procedure.status ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No procedure info found</td></tr></tbody>`;

  return createSection("Procedures", procedureTableContents);
}

function createObservationSocialHistorySection(observations: Observation[]) {
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
  });

  const observationTableContents =
    removeDuplicate.length > 0
      ? `
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
          const code = getSpecificCode(observation.code?.coding ?? [], [ICD_10_CODE, SNOMED_CODE]);

          return `
            <tr>
              <td>${observation.code?.coding?.[0]?.display ?? ""}</td>
              <td>${renderSocialHistoryValue(observation)}</td>
              <td>${code ?? ""}</td>
              <td>${dayjs(observation.effectiveDateTime).format(ISO_DATE) ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No observation info found</td></tr></tbody>`;

  return createSection("Social History", observationTableContents);
}

function renderSocialHistoryValue(observation: Observation) {
  if (observation.valueQuantity) {
    const value = observation.valueQuantity?.value;
    const unit = observation.valueQuantity?.unit?.replace(/[{()}]/g, "");

    return `${value} ${unit}`;
  } else if (observation.valueCodeableConcept) {
    return observation.valueCodeableConcept?.text;
  } else {
    return "";
  }
}

function createObservationVitalsSection(observations: Observation[]) {
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
  });

  const observationTableContents =
    removeDuplicate.length > 0
      ? `
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
          const code = getSpecificCode(observation.code?.coding ?? [], [LOINC_CODE]);

          return `
            <tr>
              <td>${observation.code?.coding?.[0]?.display ?? ""}</td>
              <td>${renderVitalsValue(observation)}</td>
              <td>${code ?? ""}</td>
              <td>${dayjs(observation.effectiveDateTime).format(ISO_DATE) ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No observation info found</td></tr></tbody>`;

  return createSection("Vitals", observationTableContents);
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

  const observationsSortedByDate = observations.sort((a, b) => {
    return dayjs(a.effectiveDateTime).isBefore(dayjs(b.effectiveDateTime)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(observationsSortedByDate, (a, b) => {
    const aDate = dayjs(a.effectiveDateTime).format(ISO_DATE);
    const bDate = dayjs(b.effectiveDateTime).format(ISO_DATE);
    return aDate === bDate && a.code?.text === b.code?.text;
  });

  const observationTableContents =
    removeDuplicate.length > 0
      ? `
    <thead>
      <tr>
        <th style="width: 30%">Observation</th>
        <th style="width: 14%">Value</th>
        <th style="width: 14%">Interpretation</th>
        <th style="width: 14%">Reference Range</th>
        <th style="width: 14%">Code</th>
        <th style="width: 14%">Date</th>
      </tr>
    </thead>
    <tbody>
      ${removeDuplicate
        .map(observation => {
          const code = getSpecificCode(observation.code?.coding ?? [], [SNOMED_CODE]);

          return `
            <tr>
              <td>${observation.code?.coding?.[0]?.display ?? ""}</td>
              <td>${observation.valueQuantity?.value ?? observation.valueString ?? ""}</td>
              <td>${observation.interpretation?.[0]?.text ?? ""}</td>
              <td>${observation.referenceRange?.[0]?.text ?? ""}</td>
              <td>${code ?? ""}</td>
              <td>${dayjs(observation.effectiveDateTime).format(ISO_DATE) ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No observation info found</td></tr></tbody>`;

  return createSection("Laboratory", observationTableContents);
}

function createOtherObservationsSection(observations: Observation[]) {
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
  });

  const observationTableContents =
    removeDuplicate.length > 0
      ? `
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
          const code = getSpecificCode(observation.code?.coding ?? [], [ICD_10_CODE, SNOMED_CODE]);

          return `
            <tr>
              <td>${observation.code?.coding?.[0]?.display ?? ""}</td>
              <td>${observation.valueQuantity?.value ?? observation.valueString ?? ""}</td>
              <td>${code ?? ""}</td>
              <td>${dayjs(observation.effectiveDateTime).format(ISO_DATE) ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No observation info found</td></tr></tbody>`;
  return createSection("Other Observations", observationTableContents);
}

function createEncountersSection(encounters: Encounter[]) {
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
          return `
            <tr>
              <td>${encounter.reasonCode?.[0]?.text ?? ""}</td>
              <td>${encounter.location?.[0]?.location?.display ?? ""}</td>
              <td>${renderClassDisplay(encounter)}</td>
              <td>${dayjs(encounter.period?.start).format(ISO_DATE) ?? ""}</td>
              <td>${dayjs(encounter.period?.end).format(ISO_DATE) ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No encounter info found</td></tr></tbody>`;

  return createSection("Encounters", encounterTableContents);
}

function renderClassDisplay(encounter: Encounter) {
  if (encounter.class?.display) {
    return encounter.class?.display;
  } else if (encounter.class?.code) {
    const extension = encounter.class?.extension?.find(coding => {
      return coding.valueCoding?.code === encounter.class?.code;
    });

    return extension?.valueCoding?.display;
  } else {
    return "";
  }
}

function createImmunizationSection(immunizations: Immunization[]) {
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
              <td>${dayjs(immunization.occurrenceDateTime).format(ISO_DATE) ?? ""}</td>
              <td>${immunization.status ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No immunization info found</td></tr></tbody>`;

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
      a.relationship?.coding?.[0]?.display === b.relationship?.coding?.[0]?.display
    );
  });

  const familyMemberHistoryTableContents =
    removeDuplicate.length > 0
      ? `
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
              <td>${familyMemberHistory.relationship?.coding?.[0]?.display ?? ""}</td>
              <td>${renderAdministrativeGender(familyMemberHistory) ?? ""}</td>
              <td>${renderFamilyHistoryConditions(familyMemberHistory)?.join(", ") ?? ""}</td>
              <td>${familyMemberHistory.deceasedBoolean ?? ""}</td>
              <td>${code ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No family member history
        info found</td></tr></tbody>`;

  return createSection("Family Member History", familyMemberHistoryTableContents);
}

function renderFamilyHistoryConditions(familyMemberHistory: FamilyMemberHistory) {
  return familyMemberHistory.condition?.map(condition => {
    return condition.code?.text;
  });
}

function renderAdministrativeGender(familyMemberHistory: FamilyMemberHistory) {
  const adminGenCode = familyMemberHistory.sex?.coding?.find(coding => {
    return coding.system?.toLowerCase().includes("administrativegender");
  })?.code;

  if (adminGenCode) {
    return adminGenCode;
  }
}

function createRelatedPersonSection(relatedPersons: RelatedPerson[]) {
  if (!relatedPersons) {
    return "";
  }

  const removeDuplicate = uniqWith(relatedPersons, (a, b) => {
    return (
      a.name?.[0]?.family === b.name?.[0]?.family &&
      a.relationship?.[0]?.coding?.[0]?.display === b.relationship?.[0]?.coding?.[0]?.display
    );
  });

  const relatedPersonTableContents =
    removeDuplicate.length > 0
      ? `
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
              <td>${relatedPerson.name?.[0]?.family ?? ""}</td>
              <td>${relatedPerson.relationship?.[0]?.coding?.[0]?.display ?? ""}</td>
              <td>${renderRelatedPersonContacts(relatedPerson)?.join(", ") ?? ""}</td>
              <td>${renderRelatedPersonAddresses(relatedPerson)?.join(", ") ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No related person info found</td></tr></tbody>`;

  return createSection("Related Persons", relatedPersonTableContents);
}

function renderRelatedPersonContacts(relatedPerson: RelatedPerson) {
  return relatedPerson.telecom?.map(telecom => {
    return `${telecom.use}: ${telecom.value}`;
  });
}

function renderRelatedPersonAddresses(relatedPerson: RelatedPerson) {
  return relatedPerson.address?.map(address => {
    return `${address.line?.join(", ")} ${address.city}, ${address.state} ${address.postalCode}`;
  });
}

function createTaskSection(tasks: Task[]) {
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
  });

  const taskTableContents =
    removeDuplicate.length > 0
      ? `
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
              <td>${dayjs(task.authoredOn).format(ISO_DATE) ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No task info found</td></tr></tbody>`;

  return createSection("Tasks", taskTableContents);
}

function createCoverageSection(coverages: Coverage[]) {
  if (!coverages) {
    return "";
  }

  const coveragesSortedByDate = coverages.sort((a, b) => {
    return dayjs(a.period?.start).isBefore(dayjs(b.period?.start)) ? 1 : -1;
  });

  const removeDuplicate = uniqWith(coveragesSortedByDate, (a, b) => {
    const aDate = dayjs(a.period?.start).format(ISO_DATE);
    const bDate = dayjs(b.period?.start).format(ISO_DATE);
    return aDate === bDate && a.type?.text === b.type?.text;
  });

  const coverageTableContents =
    removeDuplicate.length > 0
      ? `
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
          return `
            <tr>
              <td>${coverage.class?.[0]?.value ?? ""}</td>
              <td>${coverage.identifier?.[0]?.value ?? ""}</td>
              <td>${coverage.status ?? ""}</td>
              <td>${dayjs(coverage.period?.start).format(ISO_DATE) ?? ""}</td>
              <td>${dayjs(coverage.period?.end).format(ISO_DATE) ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `
      : `<tbody><tr><td>No coverage info found</td></tr></tbody>`;

  return createSection("Coverage", coverageTableContents);
}

function getSpecificCode(coding: Coding[], systemsList: string[]) {
  // return the first code that matches the system
  // systemList should be in order of priority

  for (const system of systemsList) {
    const code = coding.find(coding => {
      return coding.system?.toLowerCase().includes(system);
    })?.code;

    if (code) {
      return `${system.toUpperCase()}: ${code}`;
    }
  }
}

function createSection(title: string, tableContents: string) {
  return `
    <div id="${title.toLowerCase().replaceAll(" ", "-")}" class="section">
      <div class="section-title">
        <h3 id="${title}" title="${title}">&#x276F; ${title}</h3>
        <a href="#mr-header">&#x25B2; Back to Top</a>
      </div>
      <div class="section-content">
        <table>
          ${tableContents}
        </table>
      </div>
    </div>
  `;
}
