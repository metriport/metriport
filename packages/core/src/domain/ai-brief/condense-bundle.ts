import { SlimCondition, SlimProcedure, SlimResource } from "./modify-resources";
import { uniqWith, isEqual } from "lodash";
import fs from "fs";

export function condenseBundle(bundle: SlimResource[]): SlimResource[] {
  // Split bundle into conditions, procedures, and remaining resources
  const [conditions, procedures, remainingBundle] = bundle.reduce(
    (acc, resource) => {
      const [conditions, procedures, remaining] = acc;
      if (resource.resourceType === "Condition") {
        conditions.push(resource);
      } else if (resource.resourceType === "Procedure") {
        procedures.push(resource);
      } else {
        remaining.push(resource);
      }
      return acc;
    },
    [[], [], []] as [SlimCondition[], SlimProcedure[], SlimResource[]]
  );

  const condensedConditions = condenseConditions(conditions);
  const condensedProcedures = condenseProcedures(procedures);

  fs.writeFileSync("condensedConditions.json", JSON.stringify(condensedConditions, null, 2));
  fs.writeFileSync("condensedProcedures.json", JSON.stringify(condensedProcedures, null, 2));

  return [...remainingBundle, ...condensedConditions, ...condensedProcedures];
}

function condenseConditions(conditions: SlimCondition[]) {
  const conditionsMap = new Map<string, SlimCondition>();
  conditions.forEach(c => {
    const name = c.name;
    if (!name) return;

    const existing = conditionsMap.get(name);

    if (!existing) {
      conditionsMap.set(name, reconstructCondition(c, c));
    } else {
      conditionsMap.set(name, reconstructCondition(existing, c));
    }
  });
  return [...conditionsMap.values()];
}

function reconstructCondition(master: SlimCondition, additional?: SlimCondition) {
  const reference = {
    ...(master.reference ?? {}),
    ...(additional?.reference ?? {}),
  };

  const instances = uniqWith(
    [...(master.instances ?? []), ...(additional?.instances ?? [])],
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

function condenseProcedures(procedures: SlimProcedure[]) {
  const proceduresMap = new Map<string, SlimProcedure>();
  procedures.forEach(p => {
    const name = p.name;
    if (!name) return;

    const existing = proceduresMap.get(name);

    if (!existing) {
      proceduresMap.set(name, reconstructProcedure(p, p));
    } else {
      proceduresMap.set(name, reconstructProcedure(existing, p));
    }
  });
  return [...proceduresMap.values()];
}

function reconstructProcedure(master: SlimProcedure, additional?: SlimProcedure) {
  const reference = {
    ...(master.reference ?? {}),
    ...(additional?.reference ?? {}),
  };

  const instances = uniqWith(
    [...(master.instances ?? []), ...(additional?.instances ?? [])],
    isEqual
  );

  const fullProcedure: SlimProcedure = {
    ...master,
    reference,
    instances,
  };

  return fullProcedure;
}
