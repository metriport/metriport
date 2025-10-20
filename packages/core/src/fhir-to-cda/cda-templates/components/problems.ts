import { Bundle, CodeableConcept, Condition } from "@medplum/fhirtypes";
import { encodeToHtml } from "@metriport/shared/common/html";
import { isCondition } from "../../../external/fhir/shared";
import { ProblemsSection } from "../../cda-types/sections";
import {
  CdaCodeCe,
  CdaValueCd,
  ConcernActEntry,
  ObservationEntryRelationship,
  ObservationTableRow,
} from "../../cda-types/shared-types";
import {
  buildCodeCe,
  buildCodeCv,
  buildInstanceIdentifier,
  buildTemplateIds,
  buildValueCd,
  formatDateToCdaTimestamp,
  getTextFromCode,
  mapCodingSystem,
  notOnFilePlaceholder,
  withNullFlavor,
} from "../commons";
import {
  extensionValue2015,
  extensionValue2019,
  loincCodeSystem,
  loincSystemName,
  NOT_SPECIFIED,
  oids,
  placeholderOrgOid,
  snomedCodeSystem,
  snomedSystemName,
  _xmlnsXsiAttribute,
  _xmlnsXsiValue,
} from "../constants";
import { createTableRowsAndEntries } from "../create-table-rows-and-entries";
import { initiateSectionTable } from "../table";
import { AugmentedCondition } from "./augmented-resources";

const problemsSectionName = "problems";
const tableHeaders = [
  "ICD Code",
  "Diagnosis",
  "Provider Response",
  "Status",
  "Treatment Plan",
  "Comments",
];

export function buildProblems(fhirBundle: Bundle): ProblemsSection {
  const problemsSection: ProblemsSection = {
    templateId: buildInstanceIdentifier({
      root: oids.problemsSection,
      extension: extensionValue2015,
    }),
    code: buildCodeCe({
      code: "11450-4",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "Problem list - Reported",
    }),
    title: "PROBLEMS",
    text: notOnFilePlaceholder,
  };

  const conditions: Condition[] =
    fhirBundle.entry?.flatMap(entry => (isCondition(entry.resource) ? [entry.resource] : [])) || [];

  if (conditions.length === 0) {
    return {
      _nullFlavor: "NI",
      ...problemsSection,
    };
  }

  const augmentedConditions = conditions.map(condition => {
    return new AugmentedCondition(problemsSectionName, condition);
  });

  const { trs, entries } = createTableRowsAndEntries(
    augmentedConditions,
    createTableRowFromCondition,
    createEntryFromCondition
  );

  const table = initiateSectionTable(problemsSectionName, tableHeaders, trs);

  problemsSection.text = table;
  problemsSection.entry = entries;

  return problemsSection;
}

function createTableRowFromCondition(
  condition: AugmentedCondition,
  referenceId: string
): ObservationTableRow[] {
  const name = getTextFromCode(condition.resource.code);
  const providerResponse = mapProviderResponseToHtmlValue(
    condition.resource.verificationStatus?.coding?.[0]?.code
  );
  const clinicalStatus = mapClinicalStatus(condition.resource.clinicalStatus?.coding?.[0]?.code);

  const noteParts = condition.resource.note?.[0]?.text?.split("\n\nComments:");
  const treatmentPlan = noteParts?.[0]?.replace("Treatment plan: ", "").trim();
  const comments = noteParts?.[1]?.trim();
  return [
    {
      tr: {
        _ID: referenceId,
        ["td"]: [
          {
            "#text": getIcdCode(condition.resource.code),
          },
          {
            "#text": encodeToHtml(name),
          },
          {
            "#text": encodeToHtml(providerResponse ?? NOT_SPECIFIED),
          },
          {
            "#text": clinicalStatus?._displayName ?? NOT_SPECIFIED,
          },
          {
            "#text": encodeToHtml(
              treatmentPlan ?? condition.resource.note?.[0]?.text ?? NOT_SPECIFIED
            ),
          },
          {
            "#text": encodeToHtml(comments ?? NOT_SPECIFIED),
          },
        ],
      },
    },
  ];
}

function mapProviderResponseToHtmlValue(providerResponse: string | undefined): string | undefined {
  switch (providerResponse) {
    case "confirmed":
      return "agree";
    case "unconfirmed":
      return "disagree";
    case "refuted":
      return "resolved";
    default:
      return undefined;
  }
}

function mapClinicalStatus(clinicalStatus: string | undefined): CdaCodeCe | undefined {
  const snomedCodeCe = buildCodeCe({
    codeSystem: snomedCodeSystem,
    codeSystemName: snomedSystemName,
  });
  switch (clinicalStatus) {
    case "active":
      return buildCodeCe({
        ...snomedCodeCe,
        code: "55561003",
        displayName: "Active",
      });
    case "remission":
      return buildCodeCe({
        ...snomedCodeCe,
        code: "277022003",
        displayName: "Remission phase",
      });
    case "relapse":
      return buildCodeCe({
        ...snomedCodeCe,
        code: "263855007",
        displayName: "Relapse phase",
      });
    case "resolved":
      return buildCodeCe({
        ...snomedCodeCe,
        code: "413322009",
        displayName: "Problem resolved",
      });
    default:
      return undefined;
  }
}

function createEntryFromCondition(
  condition: AugmentedCondition,
  referenceId: string
): ConcernActEntry {
  return {
    act: {
      _classCode: "ACT",
      _moodCode: "EVN",
      templateId: buildTemplateIds({
        root: condition.typeOid,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: condition.resource.id,
      }),
      code: buildCodeCe({
        code: "CONC",
        codeSystem: "2.16.840.1.113883.5.6",
        displayName: "Concern",
      }),
      statusCode: {
        _code: "completed",
      },
      effectiveTime: {
        low: withNullFlavor(formatDateToCdaTimestamp(condition.resource.onsetDateTime), "_value"),
      },
      entryRelationship: createEntryRelationship(condition.resource, referenceId),
    },
  };
}

function getIcdCode(code: CodeableConcept | undefined): string {
  const icdCoding = code?.coding?.find(coding => {
    if (coding.system?.toLowerCase().includes("icd-10")) {
      return true;
    }
    if (mapCodingSystem(coding.system?.toLowerCase())) {
      return true;
    }
    return false;
  });
  return icdCoding?.code ?? NOT_SPECIFIED;
}

function createEntryRelationship(
  condition: Condition,
  referenceId: string
): ObservationEntryRelationship {
  return {
    _typeCode: "SUBJ",
    observation: {
      _classCode: "OBS",
      _moodCode: "EVN",
      templateId: buildTemplateIds({
        root: oids.problemObs,
        extension: extensionValue2015,
      }),
      id: buildInstanceIdentifier({
        root: placeholderOrgOid,
        extension: condition.id,
      }),
      code: buildCodeCv(
        buildCodeCe({
          code: "64572001",
          codeSystem: snomedCodeSystem,
          codeSystemName: snomedSystemName,
        }),
        [
          buildCodeCe({
            code: "75323-6",
          }),
        ]
      ),
      statusCode: {
        _code: "completed",
      },
      effectiveTime: {
        low: withNullFlavor(formatDateToCdaTimestamp(condition.recordedDate), "_value"),
      },
      value: buildValueCd(condition.code, referenceId),
      entryRelationship: buildProblemStatus(condition),
    },
  };
}

function buildProblemStatus(condition: Condition): ObservationEntryRelationship {
  return {
    _typeCode: "REFR",
    observation: {
      _classCode: "OBS",
      _moodCode: "EVN",
      templateId: buildTemplateIds({
        root: oids.problemStatus,
        extension: extensionValue2019,
      }),
      code: buildCodeCe({
        code: "33999-4",
        codeSystem: loincCodeSystem,
        codeSystemName: loincSystemName,
      }),
      statusCode: {
        _code: "completed",
      },
      effectiveTime: {
        low: withNullFlavor(formatDateToCdaTimestamp(condition.recordedDate), "_value"),
      },
      value: buildProblemStatusValue(condition.clinicalStatus?.coding?.[0]?.code),
    },
  };
}

function buildProblemStatusValue(code: string | undefined): CdaValueCd | undefined {
  if (!code) return undefined;

  const codeCe = mapClinicalStatus(code);
  return {
    ...codeCe,
    "_xsi:type": "CD",
    [_xmlnsXsiAttribute]: _xmlnsXsiValue,
  };
}
