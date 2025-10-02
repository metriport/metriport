import { Resource } from "@medplum/fhirtypes";
import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  isAllergyIntolerance,
  isCondition,
  isDiagnosticReport,
  isMedication,
  isMedicationStatement,
  isObservation,
  isProcedure,
} from "../../../fhir/shared";
import { writeBackAllergy } from "./allergy";
import { writeBackCondition } from "./condition";
import { EhrGroupedVitals, isEhrGroupedVitals, writeBackGroupedVitals } from "./grouped-vitals";
import { writeBackLab } from "./lab";
import { writeBackLabPanel } from "./lab-panel";
import { writeBackMedicationStatement } from "./medication-statement";
import { writeBackProcedure } from "./procedure";

export const writeBackEhrSources = [EhrSources.athena, EhrSources.elation];
export type WriteBackEhrSource = (typeof writeBackEhrSources)[number];
export function isEhrSourceWithWriteBack(ehr: EhrSource): ehr is WriteBackEhrSource {
  return writeBackEhrSources.includes(ehr as WriteBackEhrSource);
}

export type WriteBackResourceType =
  | "condition"
  | "lab"
  | "lab-panel"
  | "grouped-vitals"
  | "medication-statement"
  | "procedure"
  | "allergy";

export type WriteBackResourceRequest = {
  ehr: EhrSource;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  primaryResourceOrResources: Resource | EhrGroupedVitals;
  secondaryResourceOrResources?: Resource[];
  writeBackResource: WriteBackResourceType;
};

export type WriteBackResourceClientRequest = Omit<WriteBackResourceRequest, "ehr">;

export async function writeBackResource({ ...params }: WriteBackResourceRequest): Promise<void> {
  if (!isEhrSourceWithWriteBack(params.ehr)) {
    throw new BadRequestError("EHR source does not support write back", undefined, {
      ehr: params.ehr,
    });
  }
  if (params.writeBackResource === "grouped-vitals") {
    if (!isEhrGroupedVitals(params.primaryResourceOrResources)) {
      throw new BadRequestError(
        "GroupedVitals write back requires primary resource to be a grouped vitals",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    return await writeBackGroupedVitals({
      ...params,
      groupedVitals: params.primaryResourceOrResources,
    });
  }
  if (isEhrGroupedVitals(params.primaryResourceOrResources)) {
    throw new BadRequestError(
      "Non-grouped vitals write back requires primary resource to be a resource",
      undefined,
      {
        ehr: params.ehr,
        writeBackResource: params.writeBackResource,
      }
    );
  }
  if (params.writeBackResource === "condition") {
    if (!isCondition(params.primaryResourceOrResources)) {
      throw new BadRequestError(
        "Condition write back requires primary resource to be a condition",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    return await writeBackCondition({
      ...params,
      condition: params.primaryResourceOrResources,
    });
  } else if (params.writeBackResource === "lab") {
    if (!isObservation(params.primaryResourceOrResources)) {
      throw new BadRequestError(
        "Lab write back requires primary resource to be an observation",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    return await writeBackLab({
      ...params,
      observation: params.primaryResourceOrResources,
    });
  } else if (params.writeBackResource === "lab-panel") {
    if (!isDiagnosticReport(params.primaryResourceOrResources)) {
      throw new BadRequestError(
        "LabPanel write back requires primary resource to be a diagnostic report",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    if (
      !params.secondaryResourceOrResources ||
      !params.secondaryResourceOrResources.every(isObservation)
    ) {
      throw new BadRequestError(
        "LabPanel write back requires secondary resources to be observations",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    return await writeBackLabPanel({
      ...params,
      diagnosticReport: params.primaryResourceOrResources,
      observations: params.secondaryResourceOrResources,
    });
  } else if (params.writeBackResource === "medication-statement") {
    if (!isMedicationStatement(params.primaryResourceOrResources)) {
      throw new BadRequestError(
        "MedicationStatement write back requires primary resource to be a medication statement",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    if (
      !params.secondaryResourceOrResources ||
      !params.secondaryResourceOrResources.every(isMedication)
    ) {
      throw new BadRequestError(
        "MedicationStatement write back requires secondary resources be medications",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    const medication = params.secondaryResourceOrResources[0];
    if (!medication) {
      throw new BadRequestError(
        "MedicationStatement write back requires at least one secondary resource",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    return await writeBackMedicationStatement({
      ...params,
      statements: [params.primaryResourceOrResources],
      medication,
    });
  } else if (params.writeBackResource === "procedure") {
    if (!isProcedure(params.primaryResourceOrResources)) {
      throw new BadRequestError(
        "Procedure write back requires primary resource to be a procedure",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    return await writeBackProcedure({
      ...params,
      procedure: params.primaryResourceOrResources,
    });
  } else if (params.writeBackResource === "allergy") {
    if (!isAllergyIntolerance(params.primaryResourceOrResources)) {
      throw new BadRequestError(
        "Allergy write back requires primary resource to be an allergy intolerance",
        undefined,
        {
          ehr: params.ehr,
          writeBackResource: params.writeBackResource,
        }
      );
    }
    return await writeBackAllergy({
      ...params,
      allergyIntolerance: params.primaryResourceOrResources,
    });
  }
  throw new BadRequestError("Could not find handler to write back resource", undefined, {
    ehr: params.ehr,
    writeBackResource: params.writeBackResource,
  });
}
