import {
  Condition,
  DiagnosticReport,
  Medication,
  MedicationStatement,
  Observation,
  Resource,
} from "@medplum/fhirtypes";
import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { writeBackCondition } from "./condition";
import { EhrGroupedVitals, writeBackGroupedVitals } from "./grouped-vitals";
import { writeBackLab } from "./lab";
import { writeBackLabPanel } from "./lab-panel";
import { writeBackMedicationStatement } from "./medication-statement";

export type WriteBackResourceType =
  | "condition"
  | "lab"
  | "lab-panel"
  | "grouped-vitals"
  | "medication-statement";

export type WriteBackResourceRequest = {
  ehr: EhrSource;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  primaryResourceOrResources: Resource | Resource[] | EhrGroupedVitals;
  secondaryResourceOrResources?: Resource | Resource[];
  writeBackResource: WriteBackResourceType;
};

export type WriteBackResourceClientRequest = Omit<WriteBackResourceRequest, "ehr">;

export async function writeBackResource({ ...params }: WriteBackResourceRequest): Promise<void> {
  if (params.writeBackResource === "condition") {
    return await writeBackCondition({
      ...params,
      condition: params.primaryResourceOrResources as Condition,
    });
  } else if (params.writeBackResource === "lab") {
    return await writeBackLab({
      ...params,
      observation: params.primaryResourceOrResources as Observation,
    });
  } else if (params.writeBackResource === "lab-panel") {
    return await writeBackLabPanel({
      ...params,
      diagnosticReport: params.primaryResourceOrResources as DiagnosticReport,
      observations: params.secondaryResourceOrResources as Observation[],
    });
  } else if (params.writeBackResource === "grouped-vitals") {
    return await writeBackGroupedVitals({
      ...params,
      groupedVitals: params.primaryResourceOrResources as EhrGroupedVitals,
    });
  } else if (params.writeBackResource === "medication-statement") {
    return await writeBackMedicationStatement({
      ...params,
      medication: params.primaryResourceOrResources as Medication,
      statements: params.secondaryResourceOrResources as MedicationStatement[],
    });
  }
  throw new BadRequestError("Could not find handler to write back resource", undefined, {
    ehr: params.ehr,
    writeBackResource: params.writeBackResource,
  });
}
