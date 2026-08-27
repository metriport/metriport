import { CodeableConcept, Encounter, Location } from "@medplum/fhirtypes";
import { toTitleCase } from "@metriport/shared";
import { getValidCodings } from "../../codeable-concept";
import { buildReferenceFromStringRelative } from "../../bundle/bundle";
import {
  DISCHARGE_DISPOSITION_SYSTEM,
  DischargeDispositionCode,
  fhirDischargeDisposition,
} from "../../shared/discharge-disposition";

/**
 * Text-based discharge disposition patterns for normalization.
 * Based on actual values observed in consolidated FHIR data.
 *
 * Order matters - more specific patterns must come before generic ones.
 */
const dischargeDispositionPatterns: Array<{
  patterns: RegExp[];
  disposition: DischargeDispositionCode;
}> = [
  // Hospice (check before "home" patterns since "Home - Hospice" / "Hospice - home" contain "home")
  {
    patterns: [/\bhospice\b/i, /\bpalliative\b/i],
    disposition: fhirDischargeDisposition.hosp,
  },
  // Against Medical Advice / Left without being seen (check early - "Left" could match other things)
  {
    patterns: [
      /\bagainst\s*medical\s*advice\b/i,
      /\bleft\s*(against|without|ama|w\/o)\b/i,
      /\b(ama|lwbs|lwt|lwcs)\b/i,
      /\beloped?\b/i,
      /\bdiscontinued?\s*care\b/i,
      /\bwalk[- ]?away\b/i,
    ],
    disposition: fhirDischargeDisposition.aadvice,
  },
  // Deceased / Expired
  {
    patterns: [/\bexpire[ds]?\b/i, /\bdeceased\b/i, /\bdeath\b/i, /\bdied\b/i],
    disposition: fhirDischargeDisposition.exp,
  },
  // Psychiatric (check before general hospital patterns)
  {
    patterns: [/\bpsych(iatric)?\b/i, /\bmental\s*health\b/i, /\bbehavioral\s*health\b/i],
    disposition: fhirDischargeDisposition.psy,
  },
  // Rehabilitation (check before general facility patterns)
  {
    patterns: [/\brehab(ilitation)?\b/i, /\birf\b/i],
    disposition: fhirDischargeDisposition.rehab,
  },
  // Skilled Nursing Facility
  {
    patterns: [/\bsnf\b/i, /\bskilled\s*nursing\b/i, /\bsar\b/i],
    disposition: fhirDischargeDisposition.snf,
  },
  // Long-term care (LTAC, Intermediate Care, Assisted Living, Custodial, Swing Bed, Nursing Home)
  {
    patterns: [
      /\blt(a)?c\b/i,
      /\blong[- ]?term\b/i,
      /\bintermediate\s*care\b/i,
      /\bassisted\s*living\b/i,
      /\bcustodial\b/i,
      /\bswing\s*bed\b/i,
      /\bnursing\s*(home|facility)\b/i,
      /\bicf\b/i,
    ],
    disposition: fhirDischargeDisposition.long,
  },
  // Other healthcare facility (hospitals, acute care, transfers)
  {
    patterns: [
      /\bhospital\b/i,
      /\bacute\s*care\b/i,
      /\bshort[- ]?term\b/i,
      /\btrans(fer|d)\b/i,
      /\bcritical\s*access\b/i,
      /\bfederal\s*(hosp|health)\b/i,
      /\bcancer\s*center\b/i,
      /\bchildren'?s\s*hospital\b/i,
      /\binpatient\s*to\s*this\b/i,
      /\badmitted\s*(as\s*)?(an\s*)?inpatient\b/i,
      /\bpps\b/i,
    ],
    disposition: fhirDischargeDisposition.otherHcf,
  },
  // Alt-home: Home with services (home health, DME, IV therapy, etc.)
  {
    patterns: [
      /\bhome[- ]?health\b/i,
      /\bhome\s+with\s+(home\s*)?health\b/i,
      /\bhome\s+w\/\b/i,
      /\bdme\b/i,
      /\biv\s*(therapy|provider)\b/i,
      /\borganized\s*home\b/i,
      /\bunder\s*care\s*of\b/i,
      /\bcare\s*(of|by)\s*.*health\b/i,
      /\bpt\/ot\b/i,
      /\bmgmc\s*home\b/i,
    ],
    disposition: fhirDischargeDisposition.altHome,
  },
  // Plain home (self care, routine discharge)
  {
    patterns: [
      /\bhome\b/i,
      /\bself[- ]?care\b/i,
      /\broutine\s*(discharge)?\b/i,
      /\bresidence\b/i,
      /\bfoster\s*care\b/i,
      /\bgroup\s*home\b/i,
    ],
    disposition: fhirDischargeDisposition.home,
  },
  // Other (Court/law enforcement, unknown, errors, still patient, etc.)
  {
    patterns: [
      /\bcourt\b/i,
      /\blaw\s*enforcement\b/i,
      /\bjail\b/i,
      /\bprison\b/i,
      /\bunknown\b/i,
      /\berror\b/i,
      /\bvoided\b/i,
      /\bcanceled\b/i,
      /\bstill\s*(a\s*)?(patient|inhouse)\b/i,
      /\bnever\s*arrived\b/i,
      /\bdiverted\b/i,
      /\balternate\s*care\s*site\b/i,
      /\bdisaster\b/i,
    ],
    disposition: fhirDischargeDisposition.oth,
  },
];

export function filterInvalidEncounters(
  encounters: Encounter[],
  locations: Location[]
): Encounter[] {
  return encounters.flatMap(encounter => {
    const hasReason = hasEncounterReason(encounter);
    const hasLocation = hasEncounterLocation(encounter, locations);
    const hasType = hasEncounterType(encounter);
    if (!hasReason && !hasLocation && !hasType) return [];

    return encounter;
  });
}

function hasEncounterReason(encounter: Encounter): boolean {
  const reasonSet = new Set<string>();

  for (const reason of encounter.reasonCode ?? []) {
    const text = reason.text;

    if (text) {
      reasonSet.add(normalizeDisplay(text));
    }

    const codings = getValidCodings(reason.coding ?? []);

    codings.forEach(c => {
      if (c.display) reasonSet.add(normalizeDisplay(c.display));
    });
  }

  return reasonSet.size > 0;
}

function hasEncounterLocation(encounter: Encounter, locations: Location[]): boolean {
  const locationNames = encounter.location?.flatMap(locationRef => {
    const refString = locationRef.location?.reference;
    if (!refString) return [];

    const refObj = buildReferenceFromStringRelative(refString);
    const refId = refObj?.id;
    if (!refId) return [];

    return locations.find(l => l.id === refId)?.name ?? [];
  });

  return locationNames && locationNames.length > 0 ? true : false;
}

function hasEncounterType(encounter: Encounter): boolean {
  const classDisplay = encounter.class?.display;
  const isUsefulClassDisplay = isDisplayUseful(classDisplay);

  if (classDisplay && isUsefulClassDisplay) {
    return true;
  } else if (encounter.class?.extension) {
    const extension = encounter.class?.extension?.find(coding => {
      return coding.valueCoding?.code === encounter.class?.code;
    });

    const extDisplay = extension?.valueCoding?.display;
    return extDisplay && isDisplayUseful(extDisplay) ? true : false;
  } else if (encounter.type) {
    const allTypeStringSet = new Set<string>();

    for (const type of encounter.type) {
      if (type.text && isDisplayUseful(type.text)) {
        allTypeStringSet.add(normalizeDisplay(type.text));
      }
      type.coding?.forEach(c => {
        if (c.display && isDisplayUseful(c.display))
          allTypeStringSet.add(normalizeDisplay(c.display));
      });
    }
    return allTypeStringSet.size > 0;
  }

  return false;
}

/**
 * TODO Check if we can reuse isUsefulDisplay()
 */
function isDisplayUseful(display: string | undefined) {
  return display != undefined && display.trim() !== "unknown";
}

function normalizeDisplay(str: string): string {
  return toTitleCase(str.trim());
}

export function normalizeEncounters(encounters: Encounter[]): Encounter[] {
  return encounters.map(encounter => {
    if (!encounter.hospitalization?.dischargeDisposition) return encounter;

    return {
      ...encounter,
      hospitalization: {
        ...encounter.hospitalization,
        dischargeDisposition: normalizeDischargeDisposition(
          encounter.hospitalization.dischargeDisposition
        ),
      },
    };
  });
}

function normalizeDischargeDisposition(disposition: CodeableConcept): CodeableConcept {
  const text = disposition.text?.trim();
  const display = disposition.coding?.[0]?.display?.trim();
  const valueToMatch = text ?? display;

  if (!valueToMatch) return disposition;

  for (const { patterns, disposition: mappedDisposition } of dischargeDispositionPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(valueToMatch)) {
        return {
          coding: [
            {
              system: DISCHARGE_DISPOSITION_SYSTEM,
              code: mappedDisposition.code,
              display: mappedDisposition.display,
            },
          ],
          text: mappedDisposition.display,
        };
      }
    }
  }

  return disposition;
}
