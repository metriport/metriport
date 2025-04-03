import { Bundle, Resource } from "@medplum/fhirtypes";
import { makePatient } from "../../__tests__/patient";
import { processBundleUploadTransaction } from "../transaction-response-bundle";
import { faker } from "@faker-js/faker";
import {
  makeBareEncounter,
  makePractitioner,
} from "../../../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";

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

      const result = processBundleUploadTransaction(incomingBundle);

      expect(result.type).toBe("transaction-response");
      if (!result.entry) return;
      expect(result.entry).toHaveLength(1); // Patient resource won't have response

      const firstEntry = result.entry[0];
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
      const practRef = [{ individual: { reference: `Practitioner/${practId}` } }];
      const encounter = makeBareEncounter({ id: encId, participant: practRef }, ptId);
      const incomingBundle = makeTestBundle([patient, practitioner, encounter]);

      const result = processBundleUploadTransaction(incomingBundle);

      expect(result.type).toBe("transaction-response");
      if (!result.entry) return;
      expect(result.entry).toHaveLength(2); // Patient resource won't have response

      result.entry?.forEach(e => {
        expect(e.response?.status).toBe("201 Created");
      });
      const encIdPresent = result.entry?.some(
        e => e.response?.location === `Encounter/${encId}/_history/1`
      );
      const practIdPresent = result.entry?.some(
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

      const result = processBundleUploadTransaction(incomingBundle);

      expect(result.type).toBe("transaction-response");
      if (!result.entry) return;
      expect(result.entry).toHaveLength(1);

      const firstEntry = result.entry[0];
      if (!firstEntry?.response) return;
      expect(firstEntry.response.status).toBe("400");
      expect(firstEntry.response.location).toBe(`Encounter/${encId}/_history/1`);
    });
  });

  describe("updating existing resources", () => {
    it("should update existing resources of the same type", () => {
      const ptId = faker.string.uuid();
      const existingPatient = makePatient({ id: ptId });
      const existingBundle = makeTestBundle([existingPatient]);

      const updatedPatient = makePatient({ id: ptId });
      const incomingBundle = makeTestBundle([updatedPatient]);

      const result = processBundleUploadTransaction(incomingBundle, existingBundle);

      expect(result.type).toBe("transaction-response");
      if (!result.entry) return;
      expect(result.entry).toHaveLength(1);

      const firstEntry = result.entry[0];
      if (!firstEntry?.response) return;
      expect(firstEntry.response.status).toBe("200 OK");
      expect(firstEntry.response.location).toBe(`Patient/${ptId}/_history/1`);
    });
  });

  describe("referential integrity", () => {
    it("should reject resources with invalid references", () => {
      const encId = faker.string.uuid();
      const nonExistentPtId = faker.string.uuid();

      const encounter = makeBareEncounter({
        id: encId,
        subject: { reference: `Patient/${nonExistentPtId}` },
      });
      const incomingBundle = makeTestBundle([encounter]);

      const result = processBundleUploadTransaction(incomingBundle);

      expect(result.type).toBe("transaction-response");
      if (!result.entry) return;
      expect(result.entry).toHaveLength(1);

      const firstEntry = result.entry[0];
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

      const result = processBundleUploadTransaction(incomingBundle);

      expect(result.type).toBe("transaction-response");
      if (!result.entry) return;
      expect(result.entry).toHaveLength(1); // Patient won't have response

      const firstEntry = result.entry[0];
      if (!firstEntry?.response) return;
      expect(firstEntry.response.status).toBe("201 Created");
      expect(firstEntry.response.location).toBe(`Encounter/${encId}/_history/1`);
    });
  });

  describe("empty bundles", () => {
    it("should handle empty incoming bundle", () => {
      const emptyBundle = makeTestBundle([]);
      const result = processBundleUploadTransaction(emptyBundle);

      expect(result.type).toBe("transaction-response");
      expect(result.entry).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should handle empty existing bundle with new resources", () => {
      const ptId = faker.string.uuid();
      const patient = makePatient({ id: ptId });
      const incomingBundle = makeTestBundle([patient]);
      const emptyExistingBundle = makeTestBundle([]);

      const result = processBundleUploadTransaction(incomingBundle, emptyExistingBundle);

      expect(result.type).toBe("transaction-response");
      expect(result.entry).toHaveLength(0); // Patient won't have response
      expect(result.total).toBe(0);
    });
  });
});
