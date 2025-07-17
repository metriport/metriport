import { CarePlan } from "@medplum/fhirtypes";
import _ from "lodash";
import { DeduplicationResult, createKeysFromObjectArray, createRef, fillL1L2Maps } from "../shared";

export function deduplicateCarePlans(carePlans: CarePlan[]): DeduplicationResult<CarePlan> {
  const { carePlansMap, refReplacementMap, danglingReferences } = groupSameCarePlans(carePlans);
  return {
    combinedResources: Array.from(carePlansMap.values()),
    refReplacementMap,
    danglingReferences,
  };
}

export function groupSameCarePlans(carePlans: CarePlan[]): {
  carePlansMap: Map<string, CarePlan>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const l1CarePlansMap = new Map<string, string>();
  const l2CarePlansMap = new Map<string, CarePlan>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const carePlan of carePlans) {
    const setterKeys: string[] = [];
    const getterKeys: string[] = [];

    carePlan.activity?.forEach(act => {
      const dateTime = act.detail?.scheduledPeriod?.start;
      if (!dateTime) return;

      const performers = act.detail?.performer?.flatMap(p => {
        if (!p.reference || !p.reference.includes("Practitioner")) return [];

        return p.reference;
      });

      if (performers && performers.length > 0) {
        const dateAndPractitionerKeys = createKeysFromObjectArray(
          { dateTime },
          performers.map(p => ({ performer: p }))
        );

        // flagging the care plan with the date and each unique practitioner reference
        setterKeys.push(...dateAndPractitionerKeys);
        // the care plan will dedup using the date and the same practitioner reference
        getterKeys.push(...dateAndPractitionerKeys);

        // flagging the care plan with the date and 1 performer bit (meaning it has > 0 performers)
        setterKeys.push(JSON.stringify({ dateTime, performer: 1 }));
        // the care plan will dedup against ones that don't have the performer as long as they have a matching date
        getterKeys.push(JSON.stringify({ dateTime, performer: 0 }));
      } else {
        // flagging the care plan with the date and 0 performer bit (meaning it has 0 performers)
        setterKeys.push(JSON.stringify({ dateTime, performer: 0 }));
        // the care plan will dedup against ones that don't have the performer as long as they have a matching date
        getterKeys.push(JSON.stringify({ dateTime, performer: 0 }));
        // the care plan will also dedup against ones that have the performer as long as they have a matching date
        getterKeys.push(JSON.stringify({ dateTime, performer: 1 }));
      }
    });

    if (setterKeys.length > 0) {
      fillL1L2Maps({
        map1: l1CarePlansMap,
        map2: l2CarePlansMap,
        getterKeys,
        setterKeys,
        targetResource: carePlan,
        refReplacementMap,
        onPostmerge: (master: CarePlan) => {
          const dedupedActivity = _.uniqBy(master.activity, "detail.scheduledPeriod.start");
          master.activity = dedupedActivity;
          return master;
        },
      });
    } else {
      danglingReferences.add(createRef(carePlan));
    }
  }

  return {
    carePlansMap: l2CarePlansMap,
    refReplacementMap,
    danglingReferences,
  };
}
