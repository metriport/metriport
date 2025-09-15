import { Identifier, CodeableConcept } from "@medplum/fhirtypes";
import { chooseMasterOnly, chooseHighestPrecedence } from "../strategy/choose";
import { concatenateArrays } from "../strategy/concat";
import { mergeStringArrays } from "../strategy/merge";
import { mergeIdentifierArrays } from "../strategy/identifier";
import { mergeCodeableConceptArrays, mergeCodeableConcepts } from "../strategy/codeable-concept";

describe("Merge strategies", () => {
  it("should choose the master resource value", () => {
    const result = chooseMasterOnly("master", ["duplicate"]);
    expect(result).toEqual("master");
  });

  it("should choose the highest precedence resource value when master is not present", () => {
    const result = chooseHighestPrecedence(undefined, ["duplicate1", "duplicate2"]);
    expect(result).toEqual("duplicate2");
  });

  it("should concatenate arrays", () => {
    const result = concatenateArrays(
      ["element1", "element2"],
      [
        ["element3", "element4"],
        ["element5", "element6"],
      ]
    );
    expect(result).toEqual([
      "element1",
      "element2",
      "element3",
      "element4",
      "element5",
      "element6",
    ]);
  });

  it("should concatenate arrays when master is not present", () => {
    const result = concatenateArrays(undefined, [
      ["element3", "element4"],
      ["element5", "element6"],
    ]);
    expect(result).toEqual(["element3", "element4", "element5", "element6"]);
  });

  it("should concatenate arrays when master is present", () => {
    const result = concatenateArrays(
      [1, 2],
      [
        [3, 4],
        [5, 6],
      ]
    );
    expect(result).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("should concatenate arrays with duplicates", () => {
    const result = concatenateArrays(
      [1, 2],
      [
        [3, 4],
        [3, 4],
      ]
    );
    expect(result).toEqual([1, 2, 3, 4, 3, 4]);
  });

  it("should merge string arrays without duplicates", () => {
    const result = mergeStringArrays(
      ["a", "b"],
      [
        ["a", "b"],
        ["d", "e", "f"],
      ]
    );
    expect(result).toEqual(["a", "b", "d", "e", "f"]);
  });

  it("should merge identifiers without duplicates", () => {
    const masterIdentifiers: Identifier[] = [
      { system: "a", value: "b" },
      { system: "c", value: "d" },
    ];
    const resourceIdentifiers: Identifier[][] = [
      [
        { system: "a", value: "b" },
        { system: "e", value: "f" },
      ],
      [
        { system: "g", value: "h" },
        { system: "i", value: "j" },
      ],
    ];
    const result = mergeIdentifierArrays(masterIdentifiers, resourceIdentifiers);
    expect(result).toEqual([
      { system: "a", value: "b" },
      { system: "c", value: "d" },
      { system: "e", value: "f" },
      { system: "g", value: "h" },
      { system: "i", value: "j" },
    ]);
  });

  it("should merge codeable concepts without duplicates", () => {
    const result = mergeCodeableConcepts(
      {
        coding: [
          { code: "a", system: "b" },
          { code: "c", system: "d" },
        ],
      },
      [
        {
          coding: [
            { code: "a", system: "b" },
            { code: "a", system: "f" },
          ],
        },
      ]
    );
    expect(result).toEqual([
      {
        coding: [
          { code: "a", system: "b" },
          { code: "c", system: "d" },
          { code: "a", system: "f" },
        ],
      },
    ]);
  });

  it("should merge codeable concept arrays without duplicates", () => {
    const masterCodeableConcepts: CodeableConcept[] = [
      {
        coding: [
          { code: "a", system: "b" },
          { code: "c", system: "d" },
        ],
      },
    ];
    const resourceCodeableConcepts: CodeableConcept[][] = [
      [
        {
          coding: [
            { code: "a", system: "b" },
            { code: "a", system: "f" },
          ],
        },
      ],
      [
        {
          coding: [
            { code: "c", system: "d" },
            { code: "c", system: "h" },
          ],
        },
      ],
    ];
    const result = mergeCodeableConceptArrays(masterCodeableConcepts, resourceCodeableConcepts);
    expect(result).toEqual([
      {
        coding: [
          { code: "a", system: "b" },
          { code: "c", system: "d" },
          { code: "a", system: "f" },
          { code: "c", system: "h" },
        ],
      },
    ]);
  });
});
