import { faker } from "@faker-js/faker";
import { Composition, Extension } from "@medplum/fhirtypes";
import { createFilePath } from "../../../domain/filename";
import { DOC_ID_EXTENSION_URL } from "../../../external/fhir/shared/extensions/doc-id-extension";
import { makeComposition } from "../../../fhir-to-cda/cda-templates/components/__tests__/make-composition";
import { groupSameCompositions } from "../../resources/composition";

let compositionId: string;
let compositionId2: string;
let composition: Composition;
let composition2: Composition;
let sourceExtension: Extension;

beforeEach(() => {
  compositionId = faker.string.uuid();
  compositionId2 = faker.string.uuid();
  sourceExtension = {
    url: DOC_ID_EXTENSION_URL,
    valueString: createFilePath(faker.string.uuid(), faker.string.uuid(), faker.string.uuid()),
  };
  composition = makeComposition(undefined, { id: compositionId, extension: [sourceExtension] });
  composition2 = makeComposition(undefined, { id: compositionId2, extension: [sourceExtension] });
});

describe("groupSameCompositions", () => {
  it("doesn't break on an empty array", () => {
    const { compositionsMap } = groupSameCompositions([]);
    expect(compositionsMap.size).toBe(0);
  });

  it("correctly groups duplicate compositions based on the source document", () => {
    const { compositionsMap } = groupSameCompositions([composition, composition2]);
    expect(compositionsMap.size).toBe(1);
  });

  it("does not group compositions that came from different documents", () => {
    composition2.extension = [
      {
        url: DOC_ID_EXTENSION_URL,
        valueString: createFilePath(faker.string.uuid(), faker.string.uuid(), faker.string.uuid()),
      },
    ];
    const { compositionsMap } = groupSameCompositions([composition, composition2]);
    expect(compositionsMap.size).toBe(2);
  });
});
