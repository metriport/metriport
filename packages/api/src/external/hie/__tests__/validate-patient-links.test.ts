import { USState } from "@metriport/api-sdk/medical/models/common/us-data";
import * as featureFlags from "@metriport/core/command/feature-flags/domain-ffs";
import { PatientData } from "@metriport/core/domain/patient";
import { CQLink } from "../../carequality/cq-patient-data";
import { CwLink } from "../../commonwell-v1/cw-patient-data";
import {
  validateCqLinksBelongToPatient,
  validateCwLinksBelongToPatient,
} from "../validate-patient-links";
import { createCQLink, createCwLink } from "./patient-links-tests";

describe("validateLinksBelongToPatient", () => {
  const cxId = "test-cx-id";
  const basePatientData: PatientData = {
    firstName: "John",
    lastName: "Doe",
    dob: "1990-01-01",
    genderAtBirth: "M",
    address: [
      {
        addressLine1: "123 Main St",
        city: "Boston",
        state: USState.MA,
        zip: "12345",
      },
    ],
    contact: [
      {
        phone: "555-0123",
        email: "john.doe@email.com",
      },
    ],
  };

  it("should return the links as valid when patient data exactly matches", async () => {
    const patientToMatch: PatientData = { ...basePatientData };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid when contact info matches", async () => {
    const patientToMatch: PatientData = { ...basePatientData };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid when first name is different", async () => {
    const patientToMatch: PatientData = { ...basePatientData, firstName: "Jane" };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid when last name is different", async () => {
    const patientToMatch: PatientData = { ...basePatientData, lastName: "Smith" };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid with different address but matching core demographics", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      address: [
        {
          addressLine1: "456 Oak Ave",
          city: "Chicago",
          state: USState.IL,
          zip: "60601",
        },
      ],
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid with different zip code but matching city/state", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      address: [
        {
          addressLine1: "123 Main St",
          city: "Boston",
          state: USState.MA,
          zip: "02108",
        },
      ],
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid with different street but matching city/state/zip", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      address: [
        {
          addressLine1: "456 Different St",
          city: "Boston",
          state: USState.MA,
          zip: "12345",
        },
      ],
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid with multiple addresses when one matches", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      address: [
        {
          addressLine1: "789 Different St",
          city: "Chicago",
          state: USState.IL,
          zip: "60601",
        },
        {
          addressLine1: "123 Main St",
          city: "Boston",
          state: USState.MA,
          zip: "12345",
        },
      ],
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid with slight DOB variation", async () => {
    const patientToMatch: PatientData = { ...basePatientData, dob: "1990-01-02" };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid with DOB in different format but same date", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      dob: "1990-1-1",
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid with DOB off by one month", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      dob: "1990-02-01",
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid when contact info differs", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      contact: [
        {
          phone: "555-9876",
          email: "different.email@example.com",
        },
      ],
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid when only DOB and address match", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      firstName: "Jane",
      lastName: "Smith",
      genderAtBirth: "F",
      contact: [
        {
          phone: "999-9999",
          email: "different@email.com",
        },
      ],
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as valid when only gender and name match", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      dob: "1995-06-15",
      address: [
        {
          addressLine1: "789 Pine St",
          city: "Miami",
          state: USState.FL,
          zip: "33101",
        },
      ],
      contact: [
        {
          phone: "999-9999",
          email: "different@email.com",
        },
      ],
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as invalid when multiple core fields differ", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      firstName: "Jane",
      lastName: "Smith",
      dob: "1991-02-03",
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(0);
    expect(cwInvalidLinks.length).toBe(1);
    expect(cqValidNetworkLinks.length).toBe(0);
    expect(cqInvalidLinks.length).toBe(1);
  });

  it("should return the links as invalid when only address and contact info matches", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      firstName: "Jane",
      lastName: "Smith",
      dob: "1995-06-15",
      genderAtBirth: "F",
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(0);
    expect(cwInvalidLinks.length).toBe(1);
    expect(cqValidNetworkLinks.length).toBe(0);
    expect(cqInvalidLinks.length).toBe(1);
  });

  it("should return the links as invalid when only gender and first name match", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      lastName: "Smith",
      dob: "1995-06-15",
      address: [
        {
          addressLine1: "789 Pine St",
          city: "Miami",
          state: USState.FL,
          zip: "33101",
        },
      ],
      contact: [
        {
          phone: "999-9999",
          email: "different@email.com",
        },
      ],
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(0);
    expect(cwInvalidLinks.length).toBe(1);
    expect(cqValidNetworkLinks.length).toBe(0);
    expect(cqInvalidLinks.length).toBe(1);
  });

  it("should return the links as invalid with partial matches across multiple fields", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      firstName: "Jane",
      dob: "1995-06-15",
      address: [
        {
          addressLine1: "789 Pine St",
          city: "Miami",
          state: USState.FL,
          zip: "12345",
        },
      ],
      contact: [
        {
          phone: "555-0123",
          email: "different@email.com",
        },
      ],
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(0);
    expect(cwInvalidLinks.length).toBe(1);
    expect(cqValidNetworkLinks.length).toBe(0);
    expect(cqInvalidLinks.length).toBe(1);
  });
});

describe("validateLinksBelongToPatient with strict matching", () => {
  const cxId = "test-cx-id";
  const basePatientData: PatientData = {
    firstName: "John",
    lastName: "Doe",
    dob: "1990-01-01",
    genderAtBirth: "M",
    address: [
      {
        addressLine1: "123 Main St",
        city: "Boston",
        state: USState.MA,
        zip: "12345",
      },
    ],
    contact: [
      {
        phone: "555-0123",
        email: "john.doe@email.com",
      },
    ],
  };

  beforeEach(() => {
    jest.spyOn(featureFlags, "isStrictMatchingAlgorithmEnabledForCx").mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return the links as valid when patient data exactly matches", async () => {
    const patientToMatch: PatientData = { ...basePatientData };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return links as valid with comma-separated names when one matches", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      firstName: "John,Johnny",
      lastName: "Doe,Smith",
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return links as valid when one of the names in the link is an exact match", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      firstName: "John,Johnny",
      lastName: "Doe,Smith",
    };

    const cwLink = createCwLink(patientToMatch);
    if (cwLink.patient?.details?.name) {
      cwLink.patient.details.name = [
        ...cwLink.patient.details.name,
        {
          given: ["John"],
          family: ["Doe"],
        },
      ];
    }

    const cqLink = createCQLink(patientToMatch);

    if (cqLink.patientResource?.name) {
      cqLink.patientResource.name = [
        ...cqLink.patientResource.name,
        { given: ["John"], family: "Doe" },
      ];
    }

    const cwLinks: CwLink[] = [cwLink];
    const cqLinks: CQLink[] = [cqLink];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(1);
    expect(cwInvalidLinks.length).toBe(0);
    expect(cqValidNetworkLinks.length).toBe(1);
    expect(cqInvalidLinks.length).toBe(0);
  });

  it("should return the links as invalid when DOB differs", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      dob: "1990-01-02",
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(0);
    expect(cwInvalidLinks.length).toBe(1);
    expect(cqValidNetworkLinks.length).toBe(0);
    expect(cqInvalidLinks.length).toBe(1);
  });

  it("should return the links as invalid when gender differs", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      genderAtBirth: "F",
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(0);
    expect(cwInvalidLinks.length).toBe(1);
    expect(cqValidNetworkLinks.length).toBe(0);
    expect(cqInvalidLinks.length).toBe(1);
  });

  it("should return the links as invalid when no matching first name", async () => {
    const patientToMatch: PatientData = {
      ...basePatientData,
      firstName: "Jane",
    };
    const cwLinks: CwLink[] = [createCwLink(patientToMatch)];
    const cqLinks: CQLink[] = [createCQLink(patientToMatch)];

    const { validNetworkLinks: cwValidNetworkLinks, invalidLinks: cwInvalidLinks } =
      await validateCwLinksBelongToPatient(cxId, cwLinks, basePatientData);

    const { validNetworkLinks: cqValidNetworkLinks, invalidLinks: cqInvalidLinks } =
      await validateCqLinksBelongToPatient(cxId, cqLinks, basePatientData);

    expect(cwValidNetworkLinks.length).toBe(0);
    expect(cwInvalidLinks.length).toBe(1);
    expect(cqValidNetworkLinks.length).toBe(0);
    expect(cqInvalidLinks.length).toBe(1);
  });
});
