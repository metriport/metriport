import { FhirBundleSdk } from "../index";
import {
  Bundle,
  CarePlan,
  Patient,
  Practitioner,
  Organization,
  Encounter,
  Condition,
  Goal,
  CareTeam,
  MedicationRequest,
  Location,
} from "@medplum/fhirtypes";

/**
 * Test bundle with CarePlan and related resources
 */
const carePlanBundle: Bundle = {
  resourceType: "Bundle",
  id: "careplan-test-bundle",
  type: "collection",
  total: 10,
  entry: [
    {
      fullUrl: "urn:uuid:patient-123",
      resource: {
        resourceType: "Patient",
        id: "patient-123",
        name: [
          {
            family: "Smith",
            given: ["John"],
          },
        ],
        gender: "male",
        birthDate: "1980-05-15",
      } as Patient,
    },
    {
      fullUrl: "urn:uuid:practitioner-456",
      resource: {
        resourceType: "Practitioner",
        id: "practitioner-456",
        name: [
          {
            family: "Jones",
            given: ["Sarah"],
            prefix: ["Dr."],
          },
        ],
      } as Practitioner,
    },
    {
      fullUrl: "urn:uuid:org-789",
      resource: {
        resourceType: "Organization",
        id: "org-789",
        name: "Community Health Center",
      } as Organization,
    },
    {
      fullUrl: "urn:uuid:encounter-111",
      resource: {
        resourceType: "Encounter",
        id: "encounter-111",
        status: "finished",
        class: {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          code: "AMB",
        },
        subject: {
          reference: "Patient/patient-123",
        },
      } as Encounter,
    },
    {
      fullUrl: "urn:uuid:condition-222",
      resource: {
        resourceType: "Condition",
        id: "condition-222",
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: "active",
            },
          ],
        },
        subject: {
          reference: "Patient/patient-123",
        },
        code: {
          text: "Type 2 Diabetes",
        },
      } as Condition,
    },
    {
      fullUrl: "urn:uuid:goal-333",
      resource: {
        resourceType: "Goal",
        id: "goal-333",
        lifecycleStatus: "active",
        description: {
          text: "Maintain HbA1c below 7%",
        },
        subject: {
          reference: "Patient/patient-123",
        },
      } as Goal,
    },
    {
      fullUrl: "urn:uuid:careteam-444",
      resource: {
        resourceType: "CareTeam",
        id: "careteam-444",
        status: "active",
        subject: {
          reference: "Patient/patient-123",
        },
        participant: [
          {
            member: {
              reference: "Practitioner/practitioner-456",
            },
          },
        ],
      } as CareTeam,
    },
    {
      fullUrl: "urn:uuid:medicationrequest-555",
      resource: {
        resourceType: "MedicationRequest",
        id: "medicationrequest-555",
        status: "active",
        intent: "order",
        subject: {
          reference: "Patient/patient-123",
        },
        medicationCodeableConcept: {
          text: "Metformin 500mg",
        },
      } as MedicationRequest,
    },
    {
      fullUrl: "urn:uuid:location-666",
      resource: {
        resourceType: "Location",
        id: "location-666",
        name: "Diabetes Clinic",
        status: "active",
      } as Location,
    },
    {
      fullUrl: "urn:uuid:careplan-main",
      resource: {
        resourceType: "CarePlan",
        id: "careplan-main",
        status: "active",
        intent: "plan",
        title: "Diabetes Management Plan",
        description: "Comprehensive care plan for diabetes management",
        subject: {
          reference: "Patient/patient-123",
        },
        encounter: {
          reference: "Encounter/encounter-111",
        },
        author: {
          reference: "Practitioner/practitioner-456",
        },
        contributor: [
          {
            reference: "Organization/org-789",
          },
        ],
        careTeam: [
          {
            reference: "CareTeam/careteam-444",
          },
        ],
        addresses: [
          {
            reference: "Condition/condition-222",
          },
        ],
        goal: [
          {
            reference: "Goal/goal-333",
          },
        ],
        activity: [
          {
            reference: {
              reference: "MedicationRequest/medicationrequest-555",
            },
            detail: {
              kind: "MedicationRequest",
              status: "in-progress",
              location: {
                reference: "Location/location-666",
              },
              goal: [
                {
                  reference: "Goal/goal-333",
                },
              ],
              reasonReference: [
                {
                  reference: "Condition/condition-222",
                },
              ],
            },
          },
        ],
      } as CarePlan,
    },
  ],
};

/**
 * Test bundle with multiple CarePlans including basedOn, replaces, and partOf references
 */
const hierarchicalCarePlanBundle: Bundle = {
  resourceType: "Bundle",
  id: "hierarchical-careplan-bundle",
  type: "collection",
  total: 4,
  entry: [
    {
      fullUrl: "urn:uuid:patient-999",
      resource: {
        resourceType: "Patient",
        id: "patient-999",
        name: [
          {
            family: "Doe",
            given: ["Jane"],
          },
        ],
      } as Patient,
    },
    {
      fullUrl: "urn:uuid:careplan-master",
      resource: {
        resourceType: "CarePlan",
        id: "careplan-master",
        status: "active",
        intent: "plan",
        title: "Master Care Plan",
        subject: {
          reference: "Patient/patient-999",
        },
      } as CarePlan,
    },
    {
      fullUrl: "urn:uuid:careplan-old",
      resource: {
        resourceType: "CarePlan",
        id: "careplan-old",
        status: "revoked",
        intent: "plan",
        title: "Old Care Plan",
        subject: {
          reference: "Patient/patient-999",
        },
      } as CarePlan,
    },
    {
      fullUrl: "urn:uuid:careplan-child",
      resource: {
        resourceType: "CarePlan",
        id: "careplan-child",
        status: "active",
        intent: "plan",
        title: "Child Care Plan",
        subject: {
          reference: "Patient/patient-999",
        },
        basedOn: [
          {
            reference: "CarePlan/careplan-master",
          },
        ],
        replaces: [
          {
            reference: "CarePlan/careplan-old",
          },
        ],
        partOf: [
          {
            reference: "CarePlan/careplan-master",
          },
        ],
      } as CarePlan,
    },
  ],
};

describe("CarePlan Resource Support", () => {
  describe("Basic CarePlan retrieval", () => {
    it("should retrieve CarePlan resources from bundle", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      expect(carePlan?.resourceType).toBe("CarePlan");
      expect(carePlan?.id).toBe("careplan-main");
      expect(carePlan?.title).toBe("Diabetes Management Plan");
      expect(carePlan?.status).toBe("active");
      expect(carePlan?.intent).toBe("plan");
    });

    it("should return CarePlan resources by type", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlans = sdk.getCarePlans();

      expect(carePlans).toHaveLength(1);
      expect(carePlans[0]?.resourceType).toBe("CarePlan");
      expect(carePlans[0]?.id).toBe("careplan-main");
    });
  });

  describe("CarePlan smart reference methods", () => {
    it("should resolve subject reference to Patient", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const subject = carePlan?.getSubject?.();

      expect(subject).toBeDefined();
      expect(subject?.resourceType).toBe("Patient");
      expect(subject?.id).toBe("patient-123");
    });

    it("should resolve encounter reference", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const encounter = carePlan?.getEncounter?.();

      expect(encounter).toBeDefined();
      expect(encounter?.resourceType).toBe("Encounter");
      expect(encounter?.id).toBe("encounter-111");
    });

    it("should resolve author reference to Practitioner", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const author = carePlan?.getAuthor?.();

      expect(author).toBeDefined();
      expect(author?.resourceType).toBe("Practitioner");
      expect(author?.id).toBe("practitioner-456");
    });

    it("should resolve contributor references", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const contributors = carePlan?.getContributor?.();

      expect(contributors).toHaveLength(1);
      expect(contributors?.[0]?.resourceType).toBe("Organization");
      expect(contributors?.[0]?.id).toBe("org-789");
    });

    it("should resolve careTeam references", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const careTeams = carePlan?.getCareTeam?.();

      expect(careTeams).toHaveLength(1);
      expect(careTeams?.[0]?.resourceType).toBe("CareTeam");
      expect(careTeams?.[0]?.id).toBe("careteam-444");
    });

    it("should resolve addresses (condition) references", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const conditions = carePlan?.getAddresses?.();

      expect(conditions).toHaveLength(1);
      expect(conditions?.[0]?.resourceType).toBe("Condition");
      expect(conditions?.[0]?.id).toBe("condition-222");
    });

    it("should resolve goal references", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const goals = carePlan?.getGoal?.();

      expect(goals).toHaveLength(1);
      expect(goals?.[0]?.resourceType).toBe("Goal");
      expect(goals?.[0]?.id).toBe("goal-333");
    });

    it("should resolve activity reference", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const activityReferences = carePlan?.getActivityReference?.();

      expect(activityReferences).toHaveLength(1);
      expect(activityReferences?.[0]?.resourceType).toBe("MedicationRequest");
      expect(activityReferences?.[0]?.id).toBe("medicationrequest-555");
    });

    it("should resolve activity detail location", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const locations = carePlan?.getActivityDetailLocation?.();

      expect(locations).toHaveLength(1);
      expect(locations?.[0]?.resourceType).toBe("Location");
      expect(locations?.[0]?.id).toBe("location-666");
    });

    it("should resolve activity detail goal", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const goals = carePlan?.getActivityDetailGoal?.();

      expect(goals).toHaveLength(1);
      expect(goals?.[0]?.resourceType).toBe("Goal");
      expect(goals?.[0]?.id).toBe("goal-333");
    });

    it("should resolve activity detail reasonReference", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const reasons = carePlan?.getActivityDetailReasonReference?.();

      expect(reasons).toHaveLength(1);
      expect(reasons?.[0]?.resourceType).toBe("Condition");
      expect(reasons?.[0]?.id).toBe("condition-222");
    });
  });

  describe("CarePlan hierarchical references", () => {
    it("should resolve basedOn references to other CarePlans", async () => {
      const sdk = await FhirBundleSdk.create(hierarchicalCarePlanBundle);
      const childCarePlan = sdk.getResourceById<CarePlan>("careplan-child");

      expect(childCarePlan).toBeDefined();
      const basedOnPlans = childCarePlan?.getBasedOn?.();

      expect(basedOnPlans).toHaveLength(1);
      expect(basedOnPlans?.[0]?.resourceType).toBe("CarePlan");
      expect(basedOnPlans?.[0]?.id).toBe("careplan-master");
      expect(basedOnPlans?.[0]?.title).toBe("Master Care Plan");
    });

    it("should resolve replaces references to other CarePlans", async () => {
      const sdk = await FhirBundleSdk.create(hierarchicalCarePlanBundle);
      const childCarePlan = sdk.getResourceById<CarePlan>("careplan-child");

      expect(childCarePlan).toBeDefined();
      const replacedPlans = childCarePlan?.getReplaces?.();

      expect(replacedPlans).toHaveLength(1);
      expect(replacedPlans?.[0]?.resourceType).toBe("CarePlan");
      expect(replacedPlans?.[0]?.id).toBe("careplan-old");
      expect(replacedPlans?.[0]?.status).toBe("revoked");
    });

    it("should resolve partOf references to other CarePlans", async () => {
      const sdk = await FhirBundleSdk.create(hierarchicalCarePlanBundle);
      const childCarePlan = sdk.getResourceById<CarePlan>("careplan-child");

      expect(childCarePlan).toBeDefined();
      const parentPlans = childCarePlan?.getPartOf?.();

      expect(parentPlans).toHaveLength(1);
      expect(parentPlans?.[0]?.resourceType).toBe("CarePlan");
      expect(parentPlans?.[0]?.id).toBe("careplan-master");
    });
  });

  describe("CarePlan reference chaining", () => {
    it("should support chaining through CarePlan references", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-main");

      expect(carePlan).toBeDefined();
      const subject = carePlan?.getSubject?.();
      expect(subject).toBeDefined();
      expect(subject?.resourceType).toBe("Patient");

      // Chain to encounter from subject if it had one (demonstrating pattern)
      const encounter = carePlan?.getEncounter?.();
      expect(encounter).toBeDefined();
      const encounterSubject = encounter?.getSubject?.();
      expect(encounterSubject).toBeDefined();
      expect(encounterSubject?.id).toBe("patient-123");
    });
  });

  describe("CarePlan reverse references", () => {
    it("should find resources that reference a CarePlan", async () => {
      const sdk = await FhirBundleSdk.create(hierarchicalCarePlanBundle);
      const masterPlan = sdk.getResourceById<CarePlan>("careplan-master");

      expect(masterPlan).toBeDefined();
      const referencingResources = masterPlan?.getReferencingResources?.();

      expect(referencingResources?.length).toBeGreaterThan(0);
      const childPlan = referencingResources?.find(r => r.id === "careplan-child");
      expect(childPlan).toBeDefined();
      expect(childPlan?.resourceType).toBe("CarePlan");
    });
  });

  describe("CarePlan edge cases", () => {
    it("should return undefined for missing optional references", async () => {
      const minimalBundle: Bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            fullUrl: "urn:uuid:patient-minimal",
            resource: {
              resourceType: "Patient",
              id: "patient-minimal",
            } as Patient,
          },
          {
            fullUrl: "urn:uuid:careplan-minimal",
            resource: {
              resourceType: "CarePlan",
              id: "careplan-minimal",
              status: "active",
              intent: "plan",
              subject: {
                reference: "Patient/patient-minimal",
              },
            } as CarePlan,
          },
        ],
      };

      const sdk = await FhirBundleSdk.create(minimalBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-minimal");

      expect(carePlan).toBeDefined();
      expect(carePlan?.getEncounter?.()).toBeUndefined();
      expect(carePlan?.getAuthor?.()).toBeUndefined();

      const contributors = carePlan?.getContributor?.();
      expect(contributors === undefined || contributors.length === 0).toBe(true);

      const careTeams = carePlan?.getCareTeam?.();
      expect(careTeams === undefined || careTeams.length === 0).toBe(true);

      const goals = carePlan?.getGoal?.();
      expect(goals === undefined || goals.length === 0).toBe(true);
    });

    it("should handle broken references gracefully", async () => {
      const brokenRefBundle: Bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            fullUrl: "urn:uuid:careplan-broken",
            resource: {
              resourceType: "CarePlan",
              id: "careplan-broken",
              status: "active",
              intent: "plan",
              subject: {
                reference: "Patient/nonexistent-patient",
              },
              author: {
                reference: "Practitioner/nonexistent-practitioner",
              },
            } as CarePlan,
          },
        ],
      };

      const sdk = await FhirBundleSdk.create(brokenRefBundle);
      const carePlan = sdk.getResourceById<CarePlan>("careplan-broken");

      expect(carePlan).toBeDefined();
      expect(carePlan?.getSubject?.()).toBeUndefined();
      expect(carePlan?.getAuthor?.()).toBeUndefined();
    });
  });

  describe("CarePlan bundle export", () => {
    it("should export CarePlans by type", async () => {
      const sdk = await FhirBundleSdk.create(carePlanBundle);
      const carePlanOnlyBundle = sdk.exportByType("CarePlan");

      expect(carePlanOnlyBundle.entry).toHaveLength(1);
      expect(carePlanOnlyBundle.entry?.[0]?.resource?.resourceType).toBe("CarePlan");
      expect(carePlanOnlyBundle.total).toBe(1);
    });
  });
});
