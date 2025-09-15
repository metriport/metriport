import {
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationRequest,
  MedicationStatement,
} from "@medplum/fhirtypes";
import dayjs from "dayjs";
import {
  getResourcesFromBundle,
  MappedConsolidatedResources,
  SectionKey,
  getFirstCodeSpecified,
} from "..";
import { ISO_DATE } from "../../../common/date";
import { NDC_CODE, RXNORM_CODE } from "../../fhir/constants";

export type MedicationRowData = {
  id: string;
  medication: string;
  dose: string;
  code: string;
  quantity: string;
  lastFillDate: string;
  date: string;
  originalData: MedicationWithRefs;
  ehrAction?: string;
};

export type MedicationWithRefs = {
  medication: Medication;
  administration: MedicationAdministration[];
  dispense: MedicationDispense[];
  statement: MedicationStatement[];
  requests: MedicationRequest[];
};

export function medicationTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const medications = getMedications(bundle);
  return {
    key: "medications" as SectionKey,
    rowData: getMedicationRowData({ medications }),
  };
}

function getMedications(bundle: MappedConsolidatedResources | undefined): MedicationWithRefs[] {
  const medicationsWithRefs: MedicationWithRefs[] = [];

  const medications = getResourcesFromBundle<Medication>(bundle, "Medication");
  const medicationAdministration: MedicationAdministration[] =
    getResourcesFromBundle<MedicationAdministration>(bundle, "MedicationAdministration");
  const medicationDispense: MedicationDispense[] = getResourcesFromBundle<MedicationDispense>(
    bundle,
    "MedicationDispense"
  );
  const medicationStatement: MedicationStatement[] = getResourcesFromBundle<MedicationStatement>(
    bundle,
    "MedicationStatement"
  );
  const medicationRequest: MedicationRequest[] = getResourcesFromBundle<MedicationRequest>(
    bundle,
    "MedicationRequest"
  );

  for (const medication of medications) {
    const medicationWithRefs = getMedicationWithRefs(
      medication,
      medicationAdministration,
      medicationDispense,
      medicationStatement,
      medicationRequest
    );

    medicationsWithRefs.push(medicationWithRefs);
  }

  return medicationsWithRefs;
}

export function getMedicationWithRefs(
  medication: Medication,
  medicationAdministrations: MedicationAdministration[],
  medicationDispenses: MedicationDispense[],
  medicationStatements: MedicationStatement[],
  medicationRequests: MedicationRequest[]
): MedicationWithRefs {
  const medicationWithRef: MedicationWithRefs = {
    medication,
    administration: [],
    dispense: [],
    statement: [],
    requests: [],
  };

  for (const medicationTypes of [
    ...medicationAdministrations,
    ...medicationDispenses,
    ...medicationStatements,
    ...medicationRequests,
  ]) {
    const medRefId = getMedicationReferenceId(medicationTypes) || "";

    if (medRefId === medication.id) {
      if (medicationTypes.resourceType === "MedicationAdministration") {
        medicationWithRef.administration.push(medicationTypes);
      } else if (medicationTypes.resourceType === "MedicationDispense") {
        medicationWithRef.dispense.push(medicationTypes);
      } else if (medicationTypes.resourceType === "MedicationStatement") {
        medicationWithRef.statement.push(medicationTypes);
      } else if (medicationTypes.resourceType === "MedicationRequest") {
        medicationWithRef.requests.push(medicationTypes);
      }
    }
  }

  return medicationWithRef;
}

export function getMedicationReferenceId(
  medication:
    | MedicationAdministration
    | MedicationDispense
    | MedicationStatement
    | MedicationRequest
): string | undefined {
  if (medication.medicationReference?.reference) {
    return medication.medicationReference.reference.split("/")[1];
  }

  return undefined;
}

function getMedicationRowData({
  medications,
}: {
  medications: MedicationWithRefs[];
}): MedicationRowData[] {
  return medications
    .map(medicationWithRefs => ({
      id: medicationWithRefs.medication.id ?? "-",
      medication: medicationWithRefs.medication.code?.text ?? "-",
      dose: getMedicationDose(medicationWithRefs),
      quantity: getMedicationQuantity(medicationWithRefs),
      code: getMedicationCode(medicationWithRefs),
      lastFillDate: getLastFillDate(medicationWithRefs),
      date: getStartDate(medicationWithRefs),
      originalData: medicationWithRefs,
    }))
    .reduce((acc, curr) => {
      const existing = acc.find(
        row => row.medication === curr.medication && row.dose === curr.dose
      );
      if (existing) {
        if (dayjs(curr.date).isAfter(dayjs(existing.date))) {
          return acc.map(row => (row.medication === curr.medication ? curr : row));
        }
        return acc;
      }
      return [...acc, curr];
    }, [] as MedicationRowData[]);
}

export function getMedicationDose(medicationWithRefs: MedicationWithRefs): string {
  const latestAdministered = getLatestAdministered(medicationWithRefs.administration);

  const adminDosage = latestAdministered?.dosage;
  const hasValidDosage = adminDosage?.dose?.value && adminDosage?.dose?.unit;
  const adminInstructions = hasValidDosage
    ? `${adminDosage?.dose?.value} ${adminDosage?.dose?.unit}`
    : undefined;

  return adminInstructions ?? "-";
}

function getMedicationQuantity(medicationWithRefs: MedicationWithRefs): string {
  const latestDispensed = getLatestDispensed(medicationWithRefs.dispense);
  const latestStatement = getLatestStatement(medicationWithRefs.statement);

  const { value: dValue, unit: dUnit } = latestDispensed?.quantity || {};
  const mainQuantity = dValue && dUnit ? `${dValue} ${dUnit}` : undefined;

  const { value: sValue, unit: sUnit } =
    latestStatement?.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity || {};
  const fallbackQuantity = sValue && sUnit ? `${sValue} ${sUnit}` : undefined;

  return mainQuantity ?? fallbackQuantity ?? "-";
}

function getLastFillDate(medicationWithRefs: MedicationWithRefs): string {
  const latestDispensed = getLatestDispensed(medicationWithRefs.dispense);
  const hasValidDate = latestDispensed?.whenHandedOver;
  return hasValidDate ? dayjs(latestDispensed.whenHandedOver).format(ISO_DATE) : "-";
}

function getMedicationCode(medicationWithRefs: MedicationWithRefs): string {
  const coding = getFirstCodeSpecified(medicationWithRefs.medication?.code?.coding ?? [], [
    RXNORM_CODE,
    NDC_CODE,
  ]);

  if (coding) {
    return `${coding.system}: ${coding.code}`;
  }

  return "-";
}

function getStartDate(medicationWithRefs: MedicationWithRefs): string {
  const latestAdministered = getLatestAdministered(medicationWithRefs.administration);
  const latestDispensed = getLatestDispensed(medicationWithRefs.dispense);
  const latestStatement = getLatestStatement(medicationWithRefs.statement);
  const latestRequest = getLatestRequest(medicationWithRefs.requests);

  const administeredTime =
    latestAdministered?.effectiveDateTime ||
    latestAdministered?.effectivePeriod?.start ||
    latestAdministered?.effectivePeriod?.end;
  const statementTime =
    latestStatement?.effectiveDateTime ||
    latestStatement?.effectivePeriod?.start ||
    latestStatement?.effectivePeriod?.end;
  const dispensedTime = latestDispensed?.whenHandedOver;
  const requestTime = latestRequest?.authoredOn;

  const time = administeredTime || statementTime || dispensedTime || requestTime;

  if (time) {
    return dayjs(time).format(ISO_DATE);
  }

  return "-";
}

export function getLatestAdministered(
  administrations: MedicationAdministration[]
): MedicationAdministration | undefined {
  return administrations.sort((a, b) => {
    const aTime = a.effectiveDateTime || a.effectivePeriod?.start || a.effectivePeriod?.end;
    const bTime = b.effectiveDateTime || b.effectivePeriod?.start || b.effectivePeriod?.end;

    return dayjs(bTime).diff(dayjs(aTime));
  })[0];
}

export function getLatestDispensed(
  dispenses: MedicationDispense[]
): MedicationDispense | undefined {
  return dispenses.sort((a, b) => {
    const aTime = a.whenHandedOver;
    const bTime = b.whenHandedOver;
    return dayjs(bTime).diff(dayjs(aTime));
  })[0];
}

export function getLatestStatement(
  statements: MedicationStatement[]
): MedicationStatement | undefined {
  return statements.sort((a, b) => {
    const aTime = a.effectiveDateTime || a.effectivePeriod?.start || a.effectivePeriod?.end;
    const bTime = b.effectiveDateTime || b.effectivePeriod?.start || b.effectivePeriod?.end;
    return dayjs(bTime).diff(dayjs(aTime));
  })[0];
}

export function getLatestRequest(requests: MedicationRequest[]): MedicationRequest | undefined {
  return requests.sort((a, b) => {
    const aTime = a.authoredOn;
    const bTime = b.authoredOn;
    return dayjs(bTime).diff(dayjs(aTime));
  })[0];
}
