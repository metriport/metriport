import { CdaCodeCv, CdaInstanceIdentifier, CdaValueSt, Entry, EntryObject } from "./shared-types";

export interface CDAObservation {
  component: {
    observation: {
      _classCodeAttribute: Entry;
      _moodCodeAttribute: Entry;
      id?: CdaInstanceIdentifier[] | Entry;
      code: CdaCodeCv | Entry;
      text?: Entry;
      statusCode?: EntryObject;
      effectiveTime?: {
        low?: EntryObject;
        high?: EntryObject;
      };
      priorityCode?: Entry;
      // TODO support other types of values like CodeableConcept, Quantity, etc.
      value?: CdaValueSt | undefined;
    };
  };
}
