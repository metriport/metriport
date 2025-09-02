import { USState } from "@metriport/shared";
import { evaluatePatientMatch } from "../filter-patients/filter-patients";
import { crossValidateInvalidLinks } from "../filter-patients/cross-validate-links";
import { PatientData } from "../../domain/patient";

describe("evaluatePatientMatch", () => {
  const basePatient: PatientData = {
    firstName: "John",
    lastName: "Doe",
    dob: "1990-01-01",
    genderAtBirth: "M",
    address: [
      {
        addressLine1: "123 Main St",
        city: "New York",
        state: USState.NY,
        zip: "10001",
      },
    ],
    contact: [
      {
        phone: "555-123-4567",
        email: "john.doe@email.com",
      },
    ],
  };

  const basePatient2: PatientData = {
    firstName: "Jane",
    lastName: "Smith",
    dob: "1985-05-15",
    genderAtBirth: "F",
    address: [
      {
        addressLine1: "456 Oak Ave",
        city: "Los Angeles",
        state: USState.CA,
        zip: "90210",
      },
    ],
    contact: [
      {
        phone: "555-987-6543",
        email: "jane.smith@email.com",
      },
    ],
  };

  describe("Basic Matching Scenarios", () => {
    it("should match identical patients", async () => {
      const result = await evaluatePatientMatch(basePatient, basePatient);

      expect(result.isMatch).toBe(true);
      expect(result.totalScore).toBeGreaterThan(8.5);
      expect(result.scores.names).toBe(10);
      expect(result.scores.dob).toBe(8);
      expect(result.scores.gender).toBe(1);
      expect(result.scores.address).toBe(2);
      expect(result.scores.phone).toBe(2);
      expect(result.scores.email).toBe(2);
    });

    it("should not match completely different patients", async () => {
      const result = await evaluatePatientMatch(basePatient, basePatient2);

      expect(result.isMatch).toBe(false);
      expect(result.totalScore).toBeLessThan(8.5);
      expect(result.scores.names).toBe(0);
      expect(result.scores.dob).toBe(0);
      expect(result.scores.gender).toBe(0);
    });
  });

  describe("Name Matching", () => {
    it("should match exact names", async () => {
      const result = await evaluatePatientMatch(basePatient, basePatient);

      expect(result.scores.names).toBe(10);
    });

    it("should match reversed names", async () => {
      const reversedPatient = { ...basePatient, firstName: "Doe", lastName: "John" };

      const result = await evaluatePatientMatch(basePatient, reversedPatient);

      expect(result.scores.names).toBe(10);
    });

    it("should match names with spaces and hyphens", async () => {
      const patient1 = { ...basePatient, firstName: "Mary Jane", lastName: "Smith-Jones" };
      const patient2 = { ...basePatient, firstName: "MaryJane", lastName: "SmithJones" };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.scores.names).toBe(10);
    });

    it("should fail business rule for no name match", async () => {
      const patient1 = { ...basePatient, firstName: "John", lastName: "Doe" };
      const patient2 = { ...basePatient, firstName: "Jane", lastName: "Smith" };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("No Name Match");
    });
  });

  describe("DOB Matching", () => {
    it("should match exact DOB", async () => {
      const result = await evaluatePatientMatch(basePatient, basePatient);

      expect(result.scores.dob).toBe(8);
    });

    it("should match DOB with 2 overlapping parts", async () => {
      const slightlyDifferentDob = { ...basePatient, dob: "1990-01-15" };

      const result = await evaluatePatientMatch(basePatient, slightlyDifferentDob);

      expect(result.scores.dob).toBe(2);
    });

    it("should match DOB with 1 overlapping part", async () => {
      const slightlyDifferentDob = { ...basePatient, dob: "1990-02-15" };

      const result = await evaluatePatientMatch(basePatient, slightlyDifferentDob);

      expect(result.scores.dob).toBe(1);
    });
  });

  describe("Gender Matching", () => {
    it("should match same gender", async () => {
      const result = await evaluatePatientMatch(basePatient, basePatient);

      expect(result.scores.gender).toBe(1);
    });

    it("should not match different gender", async () => {
      const patientDifferentGender: PatientData = { ...basePatient, genderAtBirth: "F" };

      const result = await evaluatePatientMatch(basePatient, patientDifferentGender);

      expect(result.scores.gender).toBe(0);
    });
  });

  describe("Address Matching", () => {
    it("should match exact addresses", async () => {
      const result = await evaluatePatientMatch(basePatient, basePatient);

      expect(result.scores.address).toBe(2);
    });

    it("should match addresses with different city but same zip/state/street", async () => {
      const patientWithDifferentCity = {
        ...basePatient,
        address: [
          {
            addressLine1: "123 Main St",
            city: "Brooklyn",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const result = await evaluatePatientMatch(basePatient, patientWithDifferentCity);

      expect(result.scores.address).toBe(2);
    });

    it("should match addresses with abbreviations", async () => {
      const patientWithStreetAbbreviations = {
        ...basePatient,
        address: [
          {
            addressLine1: "123 Main Street",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const result = await evaluatePatientMatch(basePatient, patientWithStreetAbbreviations);

      expect(result.scores.address).toBe(2);
    });

    it("should match when addressLine2 is inside the other link's addressLine1", async () => {
      const patientWithAptInLine2 = {
        ...basePatient,
        address: [
          {
            addressLine1: "123 Main St",
            addressLine2: "Apt 5B",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const patientWithAptInLine1 = {
        ...basePatient,
        address: [
          {
            addressLine1: "123 Main St Apt 5B",
            addressLine2: "",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const result = await evaluatePatientMatch(patientWithAptInLine2, patientWithAptInLine1);

      expect(result.scores.address).toBe(2);
    });

    it("should match when both have addressLine2 within addressLine1 but with slightly different apartment info", async () => {
      const patient1 = {
        ...basePatient,
        address: [
          {
            addressLine1: "123 Main St",
            addressLine2: "Apt 5B",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const patient2 = {
        ...basePatient,
        address: [
          {
            addressLine1: "123 Main St Apt 5A",
            addressLine2: "",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.scores.address).toBe(2);
    });

    it("should match when both have apartment info in different formats", async () => {
      const patient1 = {
        ...basePatient,
        address: [
          {
            addressLine1: "123 Main St 5B",
            addressLine2: "",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const patient2 = {
        ...basePatient,
        address: [
          {
            addressLine1: "123 Main St Apt 5B",
            addressLine2: "",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.scores.address).toBe(2);
    });
  });

  describe("Contact Matching", () => {
    it("should match exact phone numbers", async () => {
      const result = await evaluatePatientMatch(basePatient, basePatient);

      expect(result.scores.phone).toBe(2);
    });

    it("should match exact email addresses", async () => {
      const result = await evaluatePatientMatch(basePatient, basePatient);

      expect(result.scores.email).toBe(2);
    });

    it("should not match different contact information", async () => {
      const patientWithDifferentPhone = { ...basePatient, contact: [{ phone: "555-987-6543" }] };

      const result = await evaluatePatientMatch(basePatient, patientWithDifferentPhone);

      expect(result.scores.phone).toBe(0);
    });
  });

  describe("Business Rules", () => {
    it("should fail when last name is wrong and address is completely different and contact is not a match", async () => {
      const patientWithWrongLastNameAndAddress = {
        ...basePatient,
        lastName: "Smith",
        address: [
          {
            addressLine1: "456 Oak Ave",
            city: "Los Angeles",
            state: USState.CA,
            zip: "90210",
          },
        ],
        contact: [
          {
            phone: "555-999-8888",
            email: "different.email@example.com",
          },
        ],
      };

      const result = await evaluatePatientMatch(basePatient, patientWithWrongLastNameAndAddress);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("Last Name Wrong + Address Incorrect + No Contact Match");
    });

    it("should fail when DOB has 2+ parts wrong and address is completely different", async () => {
      const patientWithDifferentDobAndAddress = {
        ...basePatient,
        dob: "1985-05-15", // Different year and month
        address: [
          {
            addressLine1: "456 Oak Ave",
            city: "Los Angeles",
            state: USState.CA,
            zip: "90210",
          },
        ],
      };

      const result = await evaluatePatientMatch(basePatient, patientWithDifferentDobAndAddress);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("DOB 2+ Parts Wrong + Address Not Same");
    });

    it("should fail when DOB has 1 part wrong, address not perfect, and no contact match", async () => {
      const patientWithDifferentDobAndAddress = {
        ...basePatient,
        dob: "1990-01-15", // Only day is different
        address: [
          {
            addressLine1: "456 Oak Ave",
            city: "Los Angeles",
            state: USState.CA,
            zip: "90210",
          },
        ],
        contact: [{ phone: "555-987-6543", email: "john.smith@email.com" }],
      };

      const result = await evaluatePatientMatch(basePatient, patientWithDifferentDobAndAddress);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("DOB 1 Part Wrong + Address Not Perfect + No Contact Match");
    });

    it("should pass when DOB has 1 part wrong, address not perfect, but contact matches", async () => {
      const patientWithDifferentDobAndAddress = {
        ...basePatient,
        dob: "1990-01-15", // Only day is different
        address: [
          {
            addressLine1: "456 Oak Ave",
            city: "Los Angeles",
            state: USState.CA,
            zip: "90210",
          },
        ],
        contact: [{ phone: "555-123-4567" }],
      };

      const result = await evaluatePatientMatch(basePatient, patientWithDifferentDobAndAddress);

      expect(result.isMatch).toBe(true);
      expect(result.failedRule).toBeUndefined();
    });

    it("should fail when DOB has 1 part wrong, same state, address not perfect, and no contact match", async () => {
      const patientWithSameStateButNoContact = {
        ...basePatient,
        dob: "1990-01-15", // Only day is different
        address: [
          {
            addressLine1: "789 Pine St", // Different address but same state
            city: "New York",
            state: USState.NY, // Same state as basePatient
            zip: "10002",
          },
        ],
        contact: [{ phone: "555-999-8888" }], // Different contact
      };

      const result = await evaluatePatientMatch(basePatient, patientWithSameStateButNoContact);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("DOB 1 Part Wrong + Address Not Perfect + No Contact Match");
    });

    it("should fail when DOB is off by more than 15 years and no parts match", async () => {
      const patientWithDifferentDob = {
        ...basePatient,
        dob: "1960-05-15",
      };

      const result = await evaluatePatientMatch(basePatient, patientWithDifferentDob);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("DOB Off By More Than 15 Years + No Parts Match");
    });

    it("should pass when DOB is off by more than 15 years but some parts match", async () => {
      const patientWithDifferentDob = {
        ...basePatient,
        dob: "1960-01-15",
      };

      const result = await evaluatePatientMatch(basePatient, patientWithDifferentDob);

      expect(result.isMatch).toBe(true);
      expect(result.failedRule).toBeUndefined();
    });

    it("should fail when DOB is off by more than 15 years and no parts match, even with address match", async () => {
      const patientWithDifferentDobAndAddress = {
        ...basePatient,
        dob: "1960-05-15", // 30 years difference, no overlapping parts
        address: [
          {
            addressLine1: "123 Main St",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const result = await evaluatePatientMatch(basePatient, patientWithDifferentDobAndAddress);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("DOB Off By More Than 15 Years + No Parts Match");
    });

    it("should fail when names don't match at all", async () => {
      const patientWithDifferentNames = {
        ...basePatient,
        firstName: "Jane",
        lastName: "Smith",
      };

      const result = await evaluatePatientMatch(basePatient, patientWithDifferentNames);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("No Name Match");
    });

    it("should pass when male has wrong last name but address matches", async () => {
      const patientWithWrongLastNameAndAddress = {
        ...basePatient,
        lastName: "Smith", // Wrong last name
      };

      const result = await evaluatePatientMatch(basePatient, patientWithWrongLastNameAndAddress);

      expect(result.isMatch).toBe(true);
      expect(result.failedRule).toBeUndefined();
    });

    it("should fail when female has wrong last name and address and contact is not a match", async () => {
      const patientWithWrongLastNameAndAddress = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Garcia", // Wrong last name
        address: [
          {
            addressLine1: "789 Pine St",
            city: "Chicago",
            state: USState.IL,
            zip: "60601",
          },
        ],
        contact: [
          {
            phone: "555-777-6666",
            email: "another.different@example.com",
          },
        ],
      };

      const result = await evaluatePatientMatch(basePatient2, patientWithWrongLastNameAndAddress);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("Last Name Wrong + Address Incorrect + No Contact Match");
    });

    it("should fail when name, address, and contact all don't match", async () => {
      const patientWithAllMismatches = {
        ...basePatient,
        firstName: "Robert", // Different first name
        address: [
          {
            addressLine1: "789 Pine St",
            city: "Chicago",
            state: USState.IL,
            zip: "60601",
          },
        ],
        contact: [{ phone: "555-999-8888" }], // Different phone
      };

      const result = await evaluatePatientMatch(basePatient, patientWithAllMismatches);

      expect(result.isMatch).toBe(false);
      expect(result.failedRule).toBe("Name + Address + Contact All Mismatch");
    });

    it("should pass when name partially matches but address matches", async () => {
      const patientWithWrongNameButRightAddress = {
        ...basePatient,
        firstName: "Robert", // Different first name
      };

      const result = await evaluatePatientMatch(basePatient, patientWithWrongNameButRightAddress);

      expect(result.isMatch).toBe(true);
      expect(result.failedRule).toBeUndefined();
    });

    it("should pass when name partially matches and address don't match but contact matches", async () => {
      const patientWithWrongNameAndAddressButRightContact = {
        ...basePatient,
        firstName: "Robert", // Different first name
        address: [
          {
            addressLine1: "789 Pine St",
            city: "Chicago",
            state: USState.IL,
            zip: "60601",
          },
        ],
      };

      const result = await evaluatePatientMatch(
        basePatient,
        patientWithWrongNameAndAddressButRightContact
      );

      expect(result.isMatch).toBe(true);
      expect(result.failedRule).toBeUndefined();
    });
  });

  describe("Cross-Link Address Validation", () => {
    it("should return empty array when no valid links", () => {
      const validLinks: PatientData[] = [];
      const invalidLinks = [basePatient2];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toEqual([]);
    });

    it("should return empty array when no invalid links", () => {
      const validLinks = [basePatient];
      const invalidLinks: PatientData[] = [];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toEqual([]);
    });

    it("should return empty array when both arrays are empty", () => {
      const validLinks: PatientData[] = [];
      const invalidLinks: PatientData[] = [];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toEqual([]);
    });

    it("should validate invalid link through contact match", () => {
      const validLink = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        contact: [{ phone: "555-123-4567", email: "john.doe@email.com" }],
      };

      const invalidLink = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Smith",
        contact: [{ phone: "555-123-4567", email: "different@email.com" }], // Same phone
      };

      const validLinks = [validLink];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(invalidLink);
    });

    it("should validate invalid link through email match", () => {
      const validLink = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        contact: [{ phone: "555-999-9999", email: "john.doe@email.com" }],
      };

      const invalidLink = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Smith",
        contact: [{ phone: "555-888-8888", email: "john.doe@email.com" }], // Same email
      };

      const validLinks = [validLink];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(invalidLink);
    });

    it("should validate invalid link through address match", () => {
      const validLink = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        address: [
          {
            addressLine1: "123 Main St",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const invalidLink = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Smith",
        address: [
          {
            addressLine1: "123 Main St",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ], // Same address
      };

      const validLinks = [validLink];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(invalidLink);
    });

    it("should not validate invalid link when no matches found", () => {
      const validLink = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        contact: [{ phone: "555-123-4567", email: "john.doe@email.com" }],
        address: [
          {
            addressLine1: "123 Main St",
            city: "New York",
            state: USState.NY,
            zip: "10001",
          },
        ],
      };

      const invalidLink = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Smith",
        contact: [{ phone: "555-999-9999", email: "jane.smith@email.com" }], // Different contact
        address: [
          {
            addressLine1: "456 Oak Ave",
            city: "Los Angeles",
            state: USState.CA,
            zip: "90210",
          },
        ], // Different address
      };

      const validLinks = [validLink];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(0);
    });

    it("should validate multiple invalid links through different valid links", () => {
      const validLink1 = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        contact: [{ phone: "555-123-4567", email: "john.doe@email.com" }],
      };

      const validLink2 = {
        ...basePatient,
        firstName: "Bob",
        lastName: "Wilson",
        address: [
          {
            addressLine1: "789 Pine St",
            city: "Chicago",
            state: USState.IL,
            zip: "60601",
          },
        ],
      };

      const invalidLink1 = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Smith",
        contact: [{ phone: "555-123-4567", email: "different@email.com" }],
      };

      const invalidLink2 = {
        ...basePatient2,
        firstName: "Alice",
        lastName: "Brown",
        address: [
          {
            addressLine1: "789 Pine St",
            city: "Chicago",
            state: USState.IL,
            zip: "60601",
          },
        ], // Matches validLink2 address
      };

      const validLinks = [validLink1, validLink2];
      const invalidLinks = [invalidLink1, invalidLink2];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(2);
      expect(result).toContain(invalidLink1);
      expect(result).toContain(invalidLink2);
    });

    it("should handle missing contact and address fields gracefully", () => {
      const validLink = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        contact: [],
        address: [],
      };

      const invalidLink = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Smith",
        contact: [],
        address: [],
      };

      const validLinks = [validLink];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(0);
    });

    it("should validate through partial contact match (phone only)", () => {
      const validLink = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        contact: [{ phone: "555-123-4567" }],
      };

      const invalidLink = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Smith",
        contact: [{ phone: "555-123-4567", email: "different@email.com" }],
      };

      const validLinks = [validLink];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(invalidLink);
    });

    it("should validate through phone number normalization", () => {
      const validLink = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        contact: [{ phone: "5551234567" }],
      };

      const invalidLink = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Smith",
        contact: [{ phone: "(555)123-4567" }],
      };

      const validLinks = [validLink];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(invalidLink);
    });

    it("should validate through partial contact match (email only)", () => {
      const validLink = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        contact: [{ email: "john.doe@email.com" }],
      };

      const invalidLink = {
        ...basePatient2,
        firstName: "Jane",
        lastName: "Smith",
        contact: [{ phone: "555-999-9999", email: "john.doe@email.com" }],
      };

      const validLinks = [validLink];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(invalidLink);
    });

    it("should validate through last name match with additional field match", () => {
      const invalidLink = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
        dob: "1990-01-02",
        contact: [{ phone: "555-999-9999", email: "different@email.com" }],
        address: [
          {
            addressLine1: "999 Different St",
            city: "Different City",
            state: USState.TX,
            zip: "99999",
          },
        ],
      };

      const validLinks = [basePatient];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(invalidLink);
    });

    it("should not validate through last name match alone without additional field match", () => {
      const invalidLink = {
        ...basePatient,
        firstName: "Jane",
        lastName: "Doe",
        dob: "1990-01-02",
        contact: [{ phone: "555-999-9999", email: "different@email.com" }],
        address: [
          {
            addressLine1: "999 Different St",
            city: "Different City",
            state: USState.TX,
            zip: "99999",
          },
        ],
      };

      const validLinks = [basePatient];
      const invalidLinks = [invalidLink];

      const result = crossValidateInvalidLinks(validLinks, invalidLinks);

      expect(result).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing optional fields", async () => {
      const patient1 = {
        ...basePatient,
        address: [],
        contact: [],
      };
      const patient2 = {
        ...basePatient,
        address: [],
        contact: [],
      };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.scores.address).toBe(0);
      expect(result.scores.phone).toBe(0);
      expect(result.scores.email).toBe(0);
      expect(result.isMatch).toBe(true);
    });

    it("should handle case sensitivity", async () => {
      const patient1 = {
        ...basePatient,
        firstName: "JOHN",
        lastName: "DOE",
      };
      const patient2 = {
        ...basePatient,
        firstName: "john",
        lastName: "doe",
      };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.scores.names).toBe(10);
    });

    it("should handle whitespace normalization", async () => {
      const patient1 = {
        ...basePatient,
        firstName: "  John  ",
        lastName: "  Doe  ",
      };
      const patient2 = {
        ...basePatient,
        firstName: "John",
        lastName: "Doe",
      };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.scores.names).toBe(10);
    });
  });

  describe("Threshold Testing", () => {
    it("should match when score equals threshold", async () => {
      const patient1 = { ...basePatient };
      const patient2 = { ...basePatient };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.isMatch).toBe(true);
      expect(result.totalScore).toBeGreaterThanOrEqual(8.5);
    });

    it("should not match when score is below threshold", async () => {
      const patient1 = { ...basePatient };
      const patient2 = { ...basePatient2 };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.isMatch).toBe(false);
      expect(result.totalScore).toBeLessThan(8.5);
    });
  });

  describe("Score Calculation", () => {
    it("should return all score components", async () => {
      const patient1 = { ...basePatient };
      const patient2 = { ...basePatient };

      const result = await evaluatePatientMatch(patient1, patient2);

      expect(result.scores).toHaveProperty("names");
      expect(result.scores).toHaveProperty("dob");
      expect(result.scores).toHaveProperty("gender");
      expect(result.scores).toHaveProperty("address");
      expect(result.scores).toHaveProperty("phone");
      expect(result.scores).toHaveProperty("email");
      expect(result.scores).toHaveProperty("ssn");
    });
  });
});
