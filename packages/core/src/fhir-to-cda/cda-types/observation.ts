import { classCodeAttribute, moodCodeAttribute } from "../cda-templates/constants";
import { CDACodeCV, CDAInstanceIdentifier, CDAValueST, Entry, EntryObject } from "./shared-types";

export interface CDAObservation {
  component: {
    observation: {
      [classCodeAttribute]: Entry;
      [moodCodeAttribute]: Entry;
      id?: CDAInstanceIdentifier[] | Entry;
      code: CDACodeCV | Entry;
      text?: Entry;
      statusCode?: EntryObject;
      effectiveTime?: {
        low?: EntryObject;
        high?: EntryObject;
      };
      priorityCode?: Entry;
      // TODO support other types of values like CodeableConcept, Quantity, etc.
      value?: CDAValueST | undefined;
    };
  };
}
