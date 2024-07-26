import { AssessmentAndPlanSection } from "../../cda-types/sections";
import { buildCodeCe, buildTemplateIds, notOnFilePlaceholder } from "../commons";
import { extensionValue2014, loincCodeSystem, loincSystemName, oids } from "../constants";

export function buildAssessmentAndPlan(): AssessmentAndPlanSection {
  // TODO: Implement the assessment and plan section mapping
  return {
    _nullFlavor: "NI",
    templateId: buildTemplateIds({
      root: oids.assessmentAndPlanSection,
      extension: extensionValue2014,
    }),
    code: buildCodeCe({
      code: "51847-2",
      codeSystem: loincCodeSystem,
      codeSystemName: loincSystemName,
      displayName: "Assessment and Plan",
    }),
    title: "ASSESSMENT AND PLAN",
    text: notOnFilePlaceholder,
  };
}
