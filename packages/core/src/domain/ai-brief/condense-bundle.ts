import { Period } from "@medplum/fhirtypes";
import { isEqual, uniqWith } from "lodash";
import {
  Instance,
  SlimCondition,
  SlimMedication,
  SlimMedicationStatement,
  SlimProcedure,
  SlimResource,
} from "./modify-resources";

export function condenseBundle(bundle: SlimResource[]): SlimResource[] {
  const [conditions, procedures, medStatements, medications, remainingBundle] = bundle.reduce(
    (acc, resource) => {
      const [conditions, procedures, medStatements, medications, remaining] = acc;
      if (resource.resourceType === "Condition") {
        conditions.push(resource);
      } else if (resource.resourceType === "Procedure") {
        procedures.push(resource);
      } else if (resource.resourceType === "MedicationStatement") {
        medStatements.push(resource);
      } else if (resource.resourceType === "Medication") {
        medications.push(resource);
      } else {
        remaining.push(resource);
      }
      return acc;
    },
    [[], [], [], [], []] as [
      SlimCondition[],
      SlimProcedure[],
      SlimMedicationStatement[],
      SlimMedication[],
      SlimResource[]
    ]
  );

  const condensedConditions = condenseSlimResources(conditions, c => c.name, mergeCondition);
  const condensedProcedures = condenseSlimResources(procedures, p => p.name, mergeProcedure);
  const condensedMedStmnts = condenseSlimResources(
    medStatements,
    s => JSON.stringify(s.reference),
    mergeMedStatement
  );
  const condensedMedications: SlimMedication = {
    resourceType: "Medication",
    sideNote: "This is a list of all previously-used medications",
    names: medications.flatMap(m => m.names ?? []),
  };

  return [
    ...remainingBundle,
    ...condensedConditions,
    ...condensedProcedures,
    ...condensedMedStmnts,
    condensedMedications,
  ];
}

function condenseSlimResources<T>(
  resources: T[],
  getKey: (item: T) => string | undefined,
  merge: (existing: T, incoming: T) => T
): T[] {
  const map = new Map<string, T>();

  resources.forEach(item => {
    const key = getKey(item);
    if (!key) return;

    const existing = map.get(key);
    map.set(key, existing ? merge(existing, item) : merge(item, item));
  });

  return [...map.values()];
}

function mergeCondition(master: SlimCondition, additional?: SlimCondition) {
  const mergedReferences = {
    ...(master.reference ?? {}),
    ...(additional?.reference ?? {}),
  };

  const newInstance = createInstanceFromPeriod(additional?.onsetPeriod);
  const instances = uniqWith(
    [master.instances, newInstance].flatMap(i => i ?? []),
    isEqual
  );

  const fullCondition: SlimCondition = {
    ...master,
    reference: mergedReferences,
    instances,
  };
  delete fullCondition.onsetPeriod;

  return fullCondition;
}

/**
 * Instance represents an occurrence of something
 */
function createInstanceFromPeriod(period: Period | undefined): Instance | undefined {
  if (!period) return undefined;
  return { onsetPeriod: period };
}

function mergeProcedure(master: SlimProcedure, additional?: SlimProcedure) {
  const mergedReferences = uniqWith(
    [master.reference, additional?.reference].flatMap(r => r ?? []),
    isEqual
  );

  const instances = uniqWith(
    [master.instances, additional?.instances].flatMap(i => i ?? []),
    isEqual
  );

  const fullProcedure: SlimProcedure = {
    ...master,
    reference: mergedReferences,
    instances,
  };

  return fullProcedure;
}

function mergeMedStatement(master: SlimMedicationStatement, additional?: SlimMedicationStatement) {
  const mergedReferences = {
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
    reference: mergedReferences,
    instances,
  };
  delete fullMedication.effectivePeriod;
  delete fullMedication.dosages;

  return fullMedication;
}
