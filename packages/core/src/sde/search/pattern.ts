export interface ExtractionPattern {
  startsWith: string[];

  pattern: AnyExtractionComponent[];
}

type AnyExtractionComponent =
  | TextComponent
  | NumberComponent
  | DateComponent
  | RegExpComponent
  | LogicComponent;

export interface ExtractionComponent {
  type: "text" | "number" | "date" | "regexp" | "logic";
  /**
   * Key name to use for the resulting extracted value.
   */
  extractAs?: string;
}

export interface LogicComponent extends ExtractionComponent {
  type: "logic";
  operator: "and" | "or";
  pattern: ExtractionComponent[];
}

export interface TextComponent extends ExtractionComponent {
  type: "text";
  value: string;
}

export interface NumberComponent extends ExtractionComponent {
  type: "number";
}

export interface DateComponent extends ExtractionComponent {
  type: "date";
}

export interface RegExpComponent extends ExtractionComponent {
  type: "regexp";
}

export const mocaPattern: ExtractionPattern = {
  startsWith: ["MOCA Score:", "MoCA Score:", "MOCA=", "MOCA ="],
  pattern: [
    { type: "number", extractAs: "mocaScore" },
    { type: "text", value: " / " },
    { type: "number", extractAs: "mocaTotal" },
  ],
};
