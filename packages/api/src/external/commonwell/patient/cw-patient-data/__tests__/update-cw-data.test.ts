import { CwLinkV2 } from "@metriport/commonwell-sdk/models/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { CwPatientDataModel } from "../../../../commonwell/models/cw-patient-data";
import { makeCwLink } from "../../../../hie/__tests__/patient-links-tests";
import { CwData, CwLinkV1 } from "../shared";
import { CwPatientDataUpdate, prepareCwPatientDataUpdatePayload } from "../update-cw-data";

describe("prepareCwPatientDataUpdatePayload", () => {
  describe("link filtering and merging", () => {
    it("should filter out v1 links from existing data and keep only v2 links", () => {
      const existingV1Link = createMockCwLinkV1();
      const existingV2Link = makeCwLink({ orgSystem: "org-1" });
      const newV2Link = makeCwLink({ orgSystem: "org-2" });

      const existing = createMockCwPatientDataModel({
        links: [existingV1Link, existingV2Link],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [newV2Link],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(2);
      expect(result.links).toContain(existingV2Link);
      expect(result.links).toContain(newV2Link);
      expect(result.links).not.toContain(existingV1Link);
    });

    it("should merge new v2 links with existing v2 links", () => {
      const existingV2Link = makeCwLink({ orgSystem: "org-1" });
      const newV2Link = makeCwLink({ orgSystem: "org-2" });

      const existing = createMockCwPatientDataModel({
        links: [existingV2Link],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [newV2Link],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(2);
      expect(result.links).toContain(existingV2Link);
      expect(result.links).toContain(newV2Link);
    });

    it("should handle empty new links array", () => {
      const existingV2Link = makeCwLink({ orgSystem: "org-1" });

      const existing = createMockCwPatientDataModel({
        links: [existingV2Link],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(1);
      expect(result.links).toContain(existingV2Link);
    });

    it("should handle undefined new links", () => {
      const existingV2Link = makeCwLink({ orgSystem: "org-1" });

      const existing = createMockCwPatientDataModel({
        links: [existingV2Link],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {},
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(1);
      expect(result.links).toContain(existingV2Link);
    });

    it("should replace v1 link with v2 link from the same facility", () => {
      // Create a v1 link from facility "facility-123"
      const existingV1Link = createMockCwLinkV1();
      // Mock the v1 link to have a specific facility identifier
      if (!existingV1Link.patient) throw new Error("V1 link patient is undefined");

      existingV1Link.patient.details.identifier = [
        {
          system: "facility-123",
          key: "patient-123",
          use: "usual",
        },
      ];

      // Create a v2 link from the same facility "facility-123"
      const newV2Link = makeCwLink({ orgSystem: "facility-123" });

      const existing = createMockCwPatientDataModel({
        links: [existingV1Link],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [newV2Link],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      // Should only contain the v2 link, not the v1 link
      expect(result.links).toHaveLength(1);
      expect(result.links).toContain(newV2Link);
      expect(result.links).not.toContain(existingV1Link);

      // Verify the v2 link has the correct facility
      const resultLink = result.links[0];
      if ("Patient" in resultLink) {
        expect(resultLink.Patient?.managingOrganization?.identifier[0]?.system).toBe(
          "facility-123"
        );
      }
    });
  });

  describe("link invalidation", () => {
    it("should filter out invalidated links", () => {
      const existingV2Link = makeCwLink({ orgSystem: "org-1" });
      const newV2Link = makeCwLink({ orgSystem: "org-2" });
      const linkToInvalidate = makeCwLink({ orgSystem: "org-1" });

      const existing = createMockCwPatientDataModel({
        links: [existingV2Link],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [newV2Link],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing, [linkToInvalidate]);

      expect(result.links).toHaveLength(1);
      expect(result.links).toContain(newV2Link);
      expect(result.links).not.toContain(existingV2Link);
    });

    it("should not filter out links when no invalidation list provided", () => {
      const existingV2Link = makeCwLink({ orgSystem: "org-1" });
      const newV2Link = makeCwLink({ orgSystem: "org-2" });

      const existing = createMockCwPatientDataModel({
        links: [existingV2Link],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [newV2Link],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(2);
      expect(result.links).toContain(existingV2Link);
      expect(result.links).toContain(newV2Link);
    });

    it("should handle empty invalidation list", () => {
      const existingV2Link = makeCwLink({ orgSystem: "org-1" });
      const newV2Link = makeCwLink({ orgSystem: "org-2" });

      const existing = createMockCwPatientDataModel({
        links: [existingV2Link],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [newV2Link],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing, []);

      expect(result.links).toHaveLength(2);
      expect(result.links).toContain(existingV2Link);
      expect(result.links).toContain(newV2Link);
    });
  });

  describe("link deduplication", () => {
    it("should deduplicate links by organization ID", () => {
      const link1 = makeCwLink({ orgSystem: "org-1" });
      const link2 = makeCwLink({ orgSystem: "org-1" }); // Same org ID
      const link3 = makeCwLink({ orgSystem: "org-2" });

      const existing = createMockCwPatientDataModel({
        links: [link1],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [link2, link3],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(2);
      // Should contain one link from org-1 and one from org-2
      const orgIds = result.links.map(link => {
        if ("Patient" in link) {
          return link.Patient?.managingOrganization?.identifier[0]?.system;
        }
        return undefined;
      });
      expect(orgIds).toContain("org-1");
      expect(orgIds).toContain("org-2");
    });
  });

  describe("link demographics history", () => {
    it("should merge link demographics history", () => {
      const existingDemographics: LinkDemographics[] = [
        {
          dob: "1990-01-01",
          gender: "male",
          names: ["John Doe"],
          addresses: ["123 Main St"],
          telephoneNumbers: ["555-1234"],
          emails: ["john@example.com"],
          driversLicenses: [],
          ssns: [],
        },
      ];

      const newDemographics: LinkDemographics[] = [
        {
          dob: "1985-05-15",
          gender: "female",
          names: ["Jane Smith"],
          addresses: ["456 Oak Ave"],
          telephoneNumbers: ["555-5678"],
          emails: ["jane@example.com"],
          driversLicenses: [],
          ssns: [],
        },
      ];

      const existing = createMockCwPatientDataModel({
        links: [],
        linkDemographicsHistory: {
          "request-1": existingDemographics,
        },
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          linkDemographicsHistory: {
            "request-2": newDemographics,
          },
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.linkDemographicsHistory).toEqual({
        "request-1": existingDemographics,
        "request-2": newDemographics,
      });
    });

    it("should handle undefined existing demographics history", () => {
      const newDemographics: LinkDemographics[] = [
        {
          dob: "1985-05-15",
          gender: "female",
          names: ["Jane Smith"],
          addresses: ["456 Oak Ave"],
          telephoneNumbers: ["555-5678"],
          emails: ["jane@example.com"],
          driversLicenses: [],
          ssns: [],
        },
      ];

      const existing = createMockCwPatientDataModel({
        links: [],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          linkDemographicsHistory: {
            "request-1": newDemographics,
          },
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.linkDemographicsHistory).toEqual({
        "request-1": newDemographics,
      });
    });

    it("should handle undefined new demographics history", () => {
      const existingDemographics: LinkDemographics[] = [
        {
          dob: "1990-01-01",
          gender: "male",
          names: ["John Doe"],
          addresses: ["123 Main St"],
          telephoneNumbers: ["555-1234"],
          emails: ["john@example.com"],
          driversLicenses: [],
          ssns: [],
        },
      ];

      const existing = createMockCwPatientDataModel({
        links: [],
        linkDemographicsHistory: {
          "request-1": existingDemographics,
        },
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {},
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.linkDemographicsHistory).toEqual({
        "request-1": existingDemographics,
      });
    });

    it("should overwrite existing demographics history when new data is provided", () => {
      const existingDemographics: LinkDemographics[] = [
        {
          dob: "1990-01-01",
          gender: "male",
          names: ["John Doe"],
          addresses: ["123 Main St"],
          telephoneNumbers: ["555-1234"],
          emails: ["john@example.com"],
          driversLicenses: [],
          ssns: [],
        },
      ];

      const newDemographics: LinkDemographics[] = [
        {
          dob: "1985-05-15",
          gender: "female",
          names: ["Jane Smith"],
          addresses: ["456 Oak Ave"],
          telephoneNumbers: ["555-5678"],
          emails: ["jane@example.com"],
          driversLicenses: [],
          ssns: [],
        },
      ];

      const existing = createMockCwPatientDataModel({
        links: [],
        linkDemographicsHistory: {
          "request-1": existingDemographics,
        },
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          linkDemographicsHistory: {
            "request-1": newDemographics, // Same request ID
          },
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.linkDemographicsHistory).toEqual({
        "request-1": newDemographics,
      });
    });
  });

  describe("data merging", () => {
    it("should merge all existing data with new data", () => {
      const existingV2Link = makeCwLink({ orgSystem: "org-1" });
      const newV2Link = makeCwLink({ orgSystem: "org-2" });

      const existingDemographics: LinkDemographics[] = [
        {
          dob: "1990-01-01",
          gender: "male",
          names: ["John Doe"],
          addresses: ["123 Main St"],
          telephoneNumbers: ["555-1234"],
          emails: ["john@example.com"],
          driversLicenses: [],
          ssns: [],
        },
      ];

      const newDemographics: LinkDemographics[] = [
        {
          dob: "1985-05-15",
          gender: "female",
          names: ["Jane Smith"],
          addresses: ["456 Oak Ave"],
          telephoneNumbers: ["555-5678"],
          emails: ["jane@example.com"],
          driversLicenses: [],
          ssns: [],
        },
      ];

      const existing = createMockCwPatientDataModel({
        links: [existingV2Link],
        linkDemographicsHistory: {
          "request-1": existingDemographics,
        },
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [newV2Link],
          linkDemographicsHistory: {
            "request-2": newDemographics,
          },
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(2);
      expect(result.links).toContain(existingV2Link);
      expect(result.links).toContain(newV2Link);
      expect(result.linkDemographicsHistory).toEqual({
        "request-1": existingDemographics,
        "request-2": newDemographics,
      });
    });

    it("should preserve existing data when new data is empty", () => {
      const existingV2Link = makeCwLink({ orgSystem: "org-1" });
      const existingDemographics: LinkDemographics[] = [
        {
          dob: "1990-01-01",
          gender: "male",
          names: ["John Doe"],
          addresses: ["123 Main St"],
          telephoneNumbers: ["555-1234"],
          emails: ["john@example.com"],
          driversLicenses: [],
          ssns: [],
        },
      ];

      const existing = createMockCwPatientDataModel({
        links: [existingV2Link],
        linkDemographicsHistory: {
          "request-1": existingDemographics,
        },
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {},
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(1);
      expect(result.links).toContain(existingV2Link);
      expect(result.linkDemographicsHistory).toEqual({
        "request-1": existingDemographics,
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty existing data", () => {
      const newV2Link = makeCwLink({ orgSystem: "org-1" });

      const existing = createMockCwPatientDataModel({
        links: [],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [newV2Link],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(1);
      expect(result.links).toContain(newV2Link);
    });

    it("should handle links with undefined organization ID", () => {
      const linkWithoutOrgId: CwLinkV2 = {
        version: 2,
        Patient: {
          identifier: [
            {
              value: "test-patient-id",
              system: "test-system",
            },
          ],
          name: [
            {
              given: ["Test"],
              family: ["Patient"],
            },
          ],
          birthDate: "1990-01-01",
          address: [
            {
              line: ["123 Test St"],
              city: "Test City",
              state: "TS",
              postalCode: "12345",
              country: "US",
            },
          ],
          managingOrganization: {
            identifier: [],
          },
        },
        Links: {
          Self: "test-self-href",
          Unlink: "test-unlink-href",
          Link: "test-link-href",
        },
      };

      const existing = createMockCwPatientDataModel({
        links: [],
      });

      const update: CwPatientDataUpdate = {
        id: "test-id",
        cxId: "test-cx-id",
        data: {
          links: [linkWithoutOrgId],
        },
      };

      const result = prepareCwPatientDataUpdatePayload(update, existing);

      expect(result.links).toHaveLength(1);
      expect(result.links).toContain(linkWithoutOrgId);
    });
  });
});

function createMockCwPatientDataModel(data: CwData): CwPatientDataModel {
  return {
    data,
  } as CwPatientDataModel;
}

function createMockCwLinkV1(): CwLinkV1 {
  return {
    _links: {
      self: {
        type: "application/json",
        href: "test-href",
        templated: false,
      },
    },
    assuranceLevel: "Level 2",
    patient: {
      details: {
        name: [
          {
            family: ["Test"],
            given: ["Patient"],
          },
        ],
        gender: {
          code: "M",
          system: "http://hl7.org/fhir/administrative-gender",
          display: "Male",
        },
        birthDate: "1990-01-01",
        address: [
          {
            zip: "12345",
            line: ["123 Test St"],
            city: "Test City",
            state: "TS",
            country: "US",
          },
        ],
      },
    },
  } as CwLinkV1;
}
