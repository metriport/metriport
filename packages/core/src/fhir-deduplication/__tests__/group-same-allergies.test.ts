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
  it("doesn't remove unknown manifestations if there is only one manifestation", () => {
    allergy.reaction = [
      {
        manifestation: unknownManifestation,
      },
    ];

    const { manifestations } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
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

  it("removes unknown substance", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: manifestationAnaphylactic,
      },
    ];
    const { manifestations, substance } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
    expect(substance?.coding).toBe(undefined);
  });

  it("keeps known substance", () => {
    allergy.reaction = [
      {
        substance: substanceNsaid,
        manifestation: manifestationAnaphylactic,
      },
    ];
    const { manifestations, substance } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
    expect(substance?.coding?.length).toBe(1);
  });

  it("strips away unknown substance", () => {
    allergy.reaction = [
      {
        substance: substanceNsaid,
        manifestation: manifestationAnaphylactic,
      },
    ];
    const { manifestations, substance } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
    expect(substance?.coding?.length).toBe(1);
  });

  it("strips away unknown substance from the reaction array", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: manifestationAnaphylactic,
      },
      {
        substance: substanceNsaid,
        manifestation: manifestationAnaphylactic,
      },
    ];
    const { manifestations, substance } = extractFromReactions(allergy.reaction);
    expect(manifestations.length).toBe(1);
    expect(substance?.coding?.length).toBe(1);
  });
});

describe("groupSameAllergies", () => {
  it("correctly groups allergies with the same reactions", () => {
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
    const masterAllergy = allergiesMap.values().next().value as AllergyIntolerance;
    expect(masterAllergy.reaction?.length).toBe(1);
    expect(masterAllergy.reaction?.[0]?.substance?.coding?.length).toBe(1);
    expect(masterAllergy.reaction?.[0]?.manifestation?.length).toBe(1);
  });

  it("correctly groups allergies with the same substance and combines manifestations", () => {
    allergy.reaction = [
      {
        substance: substanceNsaid,
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
    expect(allergiesMap.size).toBe(1);
    const masterAllergy = allergiesMap.values().next().value as AllergyIntolerance;
    expect(masterAllergy.reaction?.length).toBe(1);
    expect(masterAllergy.reaction?.[0]?.substance?.coding?.length).toBe(1);
    expect(masterAllergy.reaction?.[0]?.manifestation?.length).toBe(2);
  });

  it("does not group allergies with different substance", () => {
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

  it("removes allergies with unknown substance and manifestations ", () => {
    allergy.reaction = [
      {
        substance: noKnownAllergiesSubstance,
        manifestation: unknownManifestation,
      },
    ];

    const { allergiesMap } = groupSameAllergies([allergy]);
    expect(allergiesMap.size).toBe(0);
  });

  it("removes allergies with no known allergies for substance", () => {
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
    expect(allergiesMap.size).toBe(0);
  });

  it("removes allergies with NKA for substance in display", () => {
    allergy.reaction = [
      {
        substance: { coding: [{ ...noKnownAllergiesSubstance.coding[0], display: "NKA" }] },
        manifestation: unknownManifestation,
      },
    ];

    const result = groupSameAllergies([allergy]);
    expect(result.allergiesMap.size).toBe(0);
  });

  it("removes allergies with NKA for substance in text", () => {
    allergy.reaction = [
      {
        substance: { coding: noKnownAllergiesSubstance.coding, text: "NKA" },
        manifestation: unknownManifestation,
      },
    ];

    const result = groupSameAllergies([allergy]);
    expect(result.allergiesMap.size).toBe(0);
  });
});
