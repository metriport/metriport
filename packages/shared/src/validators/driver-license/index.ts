import { US_DL } from "./us-dl";
import { CA_DL } from "./ca-dl";
import { ValidateOptions, ValidationMatch } from "./interfaces";
import { MetriportError } from "../../error/metriport-error";

/**
 * Supported countries.
 */
const COUNTRIES = {
  US: US_DL,
  CA: CA_DL,
};

/**
 * Validates if a driver license number is valid.
 *
 * @param dl Driver license number
 * @param options Validation options
 * @returns True if valid, false otherwise
 */
export function isValid(dl: string, options: ValidateOptions = {}) {
  const result = getMatches(dl, options);
  return result !== null && result.length > 0;
}

/**
 * Gets all matching formats for a driver license number.
 *
 * @param dl Driver license number
 * @param options Validation options
 * @returns Array of matching formats or null if no matches
 */
export function getMatches(dl: string, options: ValidateOptions = {}) {
  if (!dl) {
    return null;
  }

  const country = options.country || "US";
  const countryFormats = COUNTRIES[country];

  if (!countryFormats) {
    throw new MetriportError(`Country ${country} not supported`, undefined, { country });
  }

  // Filter by state if provided
  let states: string[] = [];
  if (options.states) {
    if (typeof options.states === "string") {
      states = [options.states];
    } else {
      states = options.states;
    }

    // Validate states
    for (const state of states) {
      if (!countryFormats[state]) {
        throw new MetriportError(`State ${state} not supported for country ${country}`, undefined, {
          state,
          country,
        });
      }
    }
  } else {
    // Use all states if not specified
    states = Object.keys(countryFormats);
  }

  const matches: ValidationMatch[] = [];

  // Check each state
  for (const state of states) {
    const stateFormats = countryFormats[state];

    if (!stateFormats) continue;

    // Check each format for the state
    for (const format of stateFormats) {
      const regex = options.ignoreCase ? new RegExp(format.regex.source, "i") : format.regex;

      if (regex.test(dl)) {
        matches.push({
          state,
          description: format.description,
        });
        break; // Found a match for this state, move to next state
      }
    }
  }

  return matches.length > 0 ? matches : null;
}
