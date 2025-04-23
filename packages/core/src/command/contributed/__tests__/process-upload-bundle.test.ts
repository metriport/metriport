import { faker } from "@faker-js/faker";
import { Bundle, Resource } from "@medplum/fhirtypes";
import { makePatient } from "../../../external/fhir/__tests__/patient";
import { buildEntryReference } from "../../../external/fhir/shared";
import {
  makeBareEncounter,
  makePractitioner,
} from "../../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { processBundleUploadTransaction } from "../process-upload-bundle";

const makeTestBundle = (resources: Resource[]): Bundle<Resource> => ({
  resourceType: "Bundle",
  type: "transaction",
  entry: resources.map(resource => ({ resource })),
});

describe("processBundleUploadTransaction", () => {
  describe("creating new resources", () => {
    it("should create new resources when no existing bundle is provided", () => {
      const ptId = faker.string.uuid();
      const encId = faker.string.uuid();

      const patient = makePatient({ id: ptId });
      const encounter = makeBareEncounter({ id: encId });
      const incomingBundle = makeTestBundle([patient, encounter]);

      const { outcomesBundle } = processBundleUploadTransaction(incomingBundle);

      expect(outcomesBundle.type).toBe("transaction-response");
      if (!outcomesBundle.entry || !incomingBundle.entry) return;
      expect(outcomesBundle.entry).toHaveLength(incomingBundle.entry?.length - 1);

      const firstEntry = outcomesBundle.entry[0];
      if (!firstEntry?.response) return;
      expect(firstEntry.response.status).toBe("201 Created");
      expect(firstEntry.response.location).toBe(`Encounter/${encId}/_history/1`);
    });

    it("should create new resources when all references are provided", () => {
      const ptId = faker.string.uuid();
      const practId = faker.string.uuid();
      const encId = faker.string.uuid();

      const patient = makePatient({ id: ptId });
      const practitioner = makePractitioner({ id: practId });
      const practRef = [{ individual: { reference: buildEntryReference(practitioner) } }];

      const encounter = makeBareEncounter({ id: encId, participant: practRef }, ptId);
      const incomingBundle = makeTestBundle([patient, practitioner, encounter]);

      const { outcomesBundle } = processBundleUploadTransaction(incomingBundle);

      expect(outcomesBundle.type).toBe("transaction-response");
      if (!outcomesBundle.entry || !incomingBundle.entry) return;
      expect(outcomesBundle.entry).toHaveLength(incomingBundle.entry?.length - 1);

      outcomesBundle.entry?.forEach(e => {
        expect(e.response?.status).toBe("201 Created");
      });
      const encIdPresent = outcomesBundle.entry?.some(
        e => e.response?.location === `Encounter/${encId}/_history/1`
      );
      const practIdPresent = outcomesBundle.entry?.some(
        e => e.response?.location === `Practitioner/${practId}/_history/1`
      );
      expect(encIdPresent).toBe(true);
      expect(practIdPresent).toBe(true);
    });

    it("should return 400 when referenced resources are missing", () => {
      const ptId = faker.string.uuid();
      const practId = faker.string.uuid();
      const encId = faker.string.uuid();

      const patient = makePatient({ id: ptId });
      const practRef = [{ individual: { reference: `Practitioner/${practId}` } }];
      const encounter = makeBareEncounter({ id: encId, participant: practRef }, ptId);
      const incomingBundle = makeTestBundle([patient, encounter]);

      const { outcomesBundle } = processBundleUploadTransaction(incomingBundle);

      expect(outcomesBundle.type).toBe("transaction-response");
      if (!outcomesBundle.entry) return;
      expect(outcomesBundle.entry).toHaveLength(1);

      const firstEntry = outcomesBundle.entry[0];
      if (!firstEntry?.response) return;
      expect(firstEntry.response.status).toBe("400");
      expect(firstEntry.response.location).toBe(`Encounter/${encId}/_history/1`);
    });
  });

  describe("updating existing resources", () => {
    it("should update existing resources of the same type", () => {
      const ptId = faker.string.uuid();
      const encId = faker.string.uuid();
      const patient = makePatient({ id: ptId });

      const existingEncounter = makeBareEncounter({ id: encId }, ptId);
      const existingBundle = makeTestBundle([existingEncounter, patient]);
      const incomingBundle = makeTestBundle([existingEncounter, patient]);

      const { outcomesBundle } = processBundleUploadTransaction(incomingBundle, existingBundle);

      expect(outcomesBundle.type).toBe("transaction-response");
      if (!outcomesBundle.entry) return;
      expect(outcomesBundle.entry).toHaveLength(1);

      const firstEntry = outcomesBundle.entry[0];
      if (!firstEntry?.response) return;
      expect(firstEntry.response.status).toBe("200 OK");
      expect(firstEntry.response.location).toBe(`Encounter/${encId}/_history/1`);
    });
  });

  describe("handling larger bundles", () => {
    it("should correctly handle a bundle with new and existing resources", () => {
      const ptId = faker.string.uuid();
      const encId = faker.string.uuid();
      const practId = faker.string.uuid();
      const practId2 = faker.string.uuid();

      const patient = makePatient({ id: ptId });
      const existingEncounter = makeBareEncounter({ id: encId }, ptId);
      const practitioner1 = makePractitioner({ id: practId });
      const practitioner2 = makePractitioner({ id: practId2 });

      const existingBundle = makeTestBundle([existingEncounter, practitioner1, patient]);
      const incomingBundle = makeTestBundle([existingEncounter, practitioner2, patient]);

      const { outcomesBundle } = processBundleUploadTransaction(incomingBundle, existingBundle);

      expect(outcomesBundle.type).toBe("transaction-response");
      if (!outcomesBundle.entry || !incomingBundle.entry) return;
      expect(outcomesBundle.entry).toHaveLength(incomingBundle.entry?.length - 1);

      const firstEntry = outcomesBundle.entry[0];
      if (!firstEntry?.response) return;
      expect(firstEntry.response.status).toBe("200 OK");
      expect(firstEntry.response.location).toBe(`Encounter/${encId}/_history/1`);

      const encIdPresent = outcomesBundle.entry?.some(
        e => e.response?.location === `Encounter/${encId}/_history/1`
      );
      const pract2IdPresent = outcomesBundle.entry?.some(
        e => e.response?.location === `Practitioner/${practId2}/_history/1`
      );
      expect(encIdPresent).toBe(true);
      expect(pract2IdPresent).toBe(true);
    });
  });

  describe("referential integrity", () => {
    it("should reject resources with invalid references", () => {
      const encId = faker.string.uuid();
      const nonExistentPtId = faker.string.uuid();
      const patient = makePatient();

      const encounter = makeBareEncounter({
        id: encId,
        subject: { reference: `Patient/${nonExistentPtId}` },
      });
      const incomingBundle = makeTestBundle([encounter, patient]);

      const { outcomesBundle } = processBundleUploadTransaction(incomingBundle);

      expect(outcomesBundle.type).toBe("transaction-response");
      if (!outcomesBundle.entry || !incomingBundle.entry) return;
      expect(outcomesBundle.entry).toHaveLength(1);

      const firstEntry = outcomesBundle.entry[0];
      if (!firstEntry?.response?.outcome?.issue?.[0]?.details?.coding?.[0]) return;
      expect(firstEntry.response.status).toBe("400");
      expect(firstEntry.response.outcome.issue[0].details.coding[0].code).toBe("INVALID_REFERENCE");
    });

    it("should accept resources with valid references", () => {
      const ptId = faker.string.uuid();
      const encId = faker.string.uuid();

      const patient = makePatient({ id: ptId });
      const encounter = makeBareEncounter({
        id: encId,
        subject: { reference: `Patient/${ptId}` },
      });
      const incomingBundle = makeTestBundle([patient, encounter]);

      const { outcomesBundle } = processBundleUploadTransaction(incomingBundle);

      expect(outcomesBundle.type).toBe("transaction-response");
      if (!outcomesBundle.entry || !incomingBundle.entry) return;
      expect(outcomesBundle.entry).toHaveLength(incomingBundle.entry?.length - 1);

      const firstEntry = outcomesBundle.entry[0];
      if (!firstEntry?.response) return;
      expect(firstEntry.response.status).toBe("201 Created");
      expect(firstEntry.response.location).toBe(`Encounter/${encId}/_history/1`);
    });
  });
});
