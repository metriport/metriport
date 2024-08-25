import { faker } from "@faker-js/faker";
import { AllergyIntolerance } from "@medplum/fhirtypes";
import { allergyFood } from "../../fhir-to-cda/cda-templates/components/__tests__/allergy-examples";
import { makeAllergy } from "../../fhir-to-cda/cda-templates/components/__tests__/make-allergy";
import { extractFromReactions, groupSameAllergies } from "../resources/allergy-intolerance";
import {
  manifestationAnaphylactic,
  manifestationSkinEruption,
  noKnownAllergiesSubstance,
  substanceCashew,
  substanceNsaid,
  unknownManifestation,
} from "./examples/allergy-examples";

let allergyId: string;
let allergyId2: string;
let allergy: AllergyIntolerance;
let allergy2: AllergyIntolerance;

beforeEach(() => {
  allergyId = faker.string.uuid();
  allergyId2 = faker.string.uuid();
  allergy = makeAllergy({ id: allergyId });
  allergy2 = makeAllergy({ id: allergyId2 });
});

describe("extractFromReactions", () => {
  it("correctly removes unknown manifestations", () => {
    allergy.reaction = [
      {
        manifestation: unknownManifestation,
      },
    ];

    const { manifestations } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(0);
  });

  it("correctly removes unknown manifestations regardless of text", () => {
    allergy.reaction = [
      {
        manifestation: [
          {
            coding: unknownManifestation[0]?.coding,
            text: "some-manifestation-text",
          },
        ],
      },
    ];

    const { manifestations } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(0);
  });

  it("correctly keeps known manifestations", () => {
    allergy = { ...allergy, ...allergyFood };
    const { manifestations } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
  });

  it("correctly removes unknown manifestations", () => {
    allergy = { ...allergy, ...allergyFood };
    const foodManifestation = allergyFood.reaction?.[0]?.manifestation;
    if (foodManifestation) {
      allergy.reaction = [
        {
          manifestation: [...unknownManifestation, ...foodManifestation],
        },
      ];
    }

    const { manifestations } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
  });

  it("removes unknown substances", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: manifestationAnaphylactic,
      },
    ];
    const { manifestations, substances } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
    expect(substances.length).toBe(0);
  });

  it("keeps known substances", () => {
    allergy.reaction = [
      {
        substance: substanceNsaid,
        manifestation: manifestationAnaphylactic,
      },
    ];
    const { manifestations, substances } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
    expect(substances.length).toBe(1);
  });

  it("strips away unknown substances", () => {
    allergy.reaction = [
      {
        substance: substanceNsaid,
        manifestation: manifestationAnaphylactic,
      },
    ];
    const { manifestations, substances } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
    expect(substances.length).toBe(1);
  });

  it("strips away unknown substances from the reaction array", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: unknownManifestation,
      },
      {
        substance: substanceNsaid,
        manifestation: manifestationAnaphylactic,
      },
    ];
    const { manifestations, substances } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
    expect(substances.length).toBe(1);
  });
});

describe("groupSameAllergies", () => {
  it("correctly groups allergy reactions with the same manifestations", () => {
    allergy.reaction = [
      {
        manifestation: manifestationAnaphylactic,
      },
    ];

    allergy2.reaction = [
      {
        manifestation: manifestationAnaphylactic,
      },
    ];

    const { allergiesMap } = groupSameAllergies([allergy, allergy2]);
    expect(allergiesMap.size).toBe(1);
  });

  it("correctly groups allergy reactions with the same reactions", () => {
    allergy.reaction = [
      {
        substance: substanceCashew,
        manifestation: manifestationAnaphylactic,
      },
    ];

    allergy2.reaction = [
      {
        substance: substanceCashew,
        manifestation: manifestationAnaphylactic,
      },
    ];

    const { allergiesMap } = groupSameAllergies([allergy, allergy2]);
    expect(allergiesMap.size).toBe(1);
  });

  it("removes allergies with unknown substances and manifestations ", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: unknownManifestation,
      },
    ];

    const { allergiesMap } = groupSameAllergies([allergy, allergy2]);
    expect(allergiesMap.size).toBe(0);
  });

  it("does not group allergy reactions with different manifestations", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: unknownManifestation,
      },
    ];

    allergy2.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: manifestationAnaphylactic,
      },
    ];

    const { allergiesMap } = groupSameAllergies([allergy, allergy2]);
    expect(allergiesMap.size).toBe(1);
  });

  it("does not group allergy reactions with different substances", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: unknownManifestation,
      },
    ];

    allergy2.reaction = [
      {
        substance: substanceNsaid,
        manifestation: unknownManifestation,
      },
    ];

    const { allergiesMap } = groupSameAllergies([allergy, allergy2]);
    expect(allergiesMap.size).toBe(1);
  });

  it("does not group allergy reactions with different substances", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: unknownManifestation,
      },
    ];

    allergy2.reaction = [
      {
        substance: substanceNsaid,
        manifestation: unknownManifestation,
      },
    ];

    const { allergiesMap } = groupSameAllergies([allergy, allergy2]);
    expect(allergiesMap.size).toBe(1);
  });

  it("does not group allergy reactions with different manifestations", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: manifestationAnaphylactic,
      },
    ];

    allergy2.reaction = [
      {
        substance: substanceNsaid,
        manifestation: manifestationSkinEruption,
      },
    ];

    const { allergiesMap } = groupSameAllergies([allergy, allergy2]);
    expect(allergiesMap.size).toBe(2);
  });

  it("does not group allergy reactions with different substances", () => {
    allergy.reaction = [
      {
        substance: substanceCashew,
        manifestation: unknownManifestation,
      },
    ];

    allergy2.reaction = [
      {
        substance: substanceNsaid,
        manifestation: unknownManifestation,
      },
    ];

    const { allergiesMap } = groupSameAllergies([allergy, allergy2]);
    expect(allergiesMap.size).toBe(2);
  });
});
