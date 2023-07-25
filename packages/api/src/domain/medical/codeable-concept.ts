export type Coding = {
  system?: string | null;
  code?: string | null;
  display?: string | null;
};

export type CodeableConcept = {
  coding?: Coding[];
  text?: string | null;
};
