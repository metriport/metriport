import { classCodeAttribute, moodCodeAttribute } from "../cda-templates/constants";
import { Entry, CDAInstanceIdentifier, CDACodeCV } from "./shared-types";

export interface CDAObservation {
  component: {
    observation: {
      [classCodeAttribute]: Entry;
      [moodCodeAttribute]: Entry;
      id?: CDAInstanceIdentifier[] | Entry;
      code: CDACodeCV | Entry;
      text?: Entry;
      statusCode?: {
        code: Entry;
      };
      effectiveTime?: {
        value: Entry;
      };
      priorityCode?: Entry;
      // TODO support other types of values like CodeableConcept, Quantity, etc.
      value?: string | undefined;
    };
  };
}
