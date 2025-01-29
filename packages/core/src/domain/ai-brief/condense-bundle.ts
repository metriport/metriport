import { Period } from "@medplum/fhirtypes";
import fs from "fs";
import { isEqual, uniqWith } from "lodash";
import {
  SlimCondition,
  SlimMedicationStatement,
  SlimProcedure,
  SlimResource,
} from "./modify-resources";

export function condenseBundle(bundle: SlimResource[]): SlimResource[] {
  // Split bundle into conditions, procedures, medications, and remaining resources
  const [conditions, procedures, medStatements, remainingBundle] = bundle.reduce(
    (acc, resource) => {
      const [conditions, procedures, medStatements, remaining] = acc;
      if (resource.resourceType === "Condition") {
        conditions.push(resource);
      } else if (resource.resourceType === "Procedure") {
        procedures.push(resource);
      } else if (resource.resourceType === "MedicationStatement") {
        medStatements.push(resource);
      } else {
        remaining.push(resource);
      }
      return acc;
    },
    [[], [], [], []] as [
      SlimCondition[],
      SlimProcedure[],
      SlimMedicationStatement[],
      SlimResource[]
    ]
  );

  const condensedConditions = condenseSlimResources(conditions, c => c.name, reconstructCondition);
  const condensedProcedures = condenseSlimResources(procedures, p => p.name, reconstructProcedure);
  const condensedMedStmnts = condenseSlimResources(
    medStatements,
    s => JSON.stringify(s.reference),
    reconstructMedStatement
  );

  fs.writeFileSync("condensedConditions.json", JSON.stringify(condensedConditions, null, 2));
  fs.writeFileSync("condensedProcedures.json", JSON.stringify(condensedProcedures, null, 2));
  fs.writeFileSync("condensedMedStmnts.json", JSON.stringify(condensedMedStmnts, null, 2));

  return [
    ...remainingBundle,
    ...condensedConditions,
    ...condensedProcedures,
    ...condensedMedStmnts,
  ];
}

function condenseSlimResources<T>(
  items: T[],
  getKey: (item: T) => string | undefined,
  merge: (existing: T, incoming: T) => T
): T[] {
  const map = new Map<string, T>();

  items.forEach(item => {
    const key = getKey(item);
    if (!key) return;

    const existing = map.get(key);
    map.set(key, existing ? merge(existing, item) : merge(item, item));
  });

  return [...map.values()];
}

function reconstructCondition(master: SlimCondition, additional?: SlimCondition) {
  const reference = {
    ...(master.reference ?? {}),
    ...(additional?.reference ?? {}),
  };

  const newInstance = createInstanceFromCondition(additional?.onsetPeriod);
  const instances = uniqWith(
    [master.instances, newInstance].flatMap(i => i ?? []),
    isEqual
  );

  const fullCondition: SlimCondition = {
    ...master,
    reference,
    instances,
  };
  delete fullCondition.onsetPeriod;

  return fullCondition;
}

function createInstanceFromCondition(period: Period | undefined) {
  if (!period) return undefined;
  return { onsetPeriod: period };
}

function reconstructProcedure(master: SlimProcedure, additional?: SlimProcedure) {
  const references = uniqWith(
    [master.reference, additional?.reference].flatMap(r => r ?? []),
    isEqual
  );

  const instances = uniqWith(
    [master.instances, additional?.instances].flatMap(i => i ?? []),
    isEqual
  );

  const fullProcedure: SlimProcedure = {
    ...master,
    reference: references,
    instances,
  };

  return fullProcedure;
}

function reconstructMedStatement(
  master: SlimMedicationStatement,
  additional?: SlimMedicationStatement
) {
  const reference = {
    ...(master.reference ?? {}),
    ...(additional?.reference ?? {}),
  };

  const newInstance = {
    dosages: additional?.dosages,
    date: additional?.effectivePeriod,
  };

  const instances = uniqWith(
    [master.instances, newInstance].flatMap(i => i ?? []),
    isEqual
  );

  const fullMedication: SlimMedicationStatement = {
    ...master,
    reference,
    instances,
  };
  delete fullMedication.effectivePeriod;
  delete fullMedication.dosages;

  return fullMedication;
}
