/* eslint-disable @typescript-eslint/no-empty-function */
import { addressArraySchemaSafe } from "../address";

describe("address validation", () => {
  describe("addressArraySchemaSafe - filtering invalid addresses", () => {
    it("keeps valid addresses and removes invalid ones", async () => {
      const addresses = [
        {
          line: ["123 Main St"],
          city: "New York",
          state: "NY",
        },
        {
          line: ["456 Oak Ave"],
          city: "Los Angeles",
          state: "invalid state", // Invalid - should be filtered out
        },
        {
          line: ["789 Pine St"],
          city: "Chicago",
          state: "IL",
        },
        {
          line: ["101 Elm St"],
          city: "Boston",
          state: "MA",
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(3);
      expect(result[0]?.city).toBe("New York");
      expect(result[1]?.city).toBe("Chicago");
      expect(result[2]?.city).toBe("Boston");
    });

    it("filters out addresses with invalid state codes", async () => {
      const addresses = [
        {
          line: ["123 Main St"],
          city: "New York",
          state: "NY", // Valid
        },
        {
          line: ["456 Oak Ave"],
          city: "Los Angeles",
          state: "XYZ", // Invalid state
        },
        {
          line: ["789 Pine St"],
          city: "Chicago",
          state: "invalid", // Invalid state
        },
        {
          line: ["101 Elm St"],
          city: "Boston",
          state: "MA", // Valid
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(2);
      expect(result[0]?.city).toBe("New York");
      expect(result[1]?.city).toBe("Boston");
    });

    it("filters out addresses with missing or invalid city", async () => {
      const addresses = [
        {
          line: ["123 Main St"],
          city: "New York",
          state: "NY",
        },
        {
          line: ["456 Oak Ave"],
          city: "", // Empty city - invalid
          state: "CA",
        },
        {
          line: ["789 Pine St"],
          city: "AB", // Too short city - invalid
          state: "IL",
        },
        {
          line: ["101 Elm St"],
          city: "Boston",
          state: "MA",
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(2);
      expect(result[0]?.city).toBe("New York");
      expect(result[1]?.city).toBe("Boston");
    });

    it("filters out addresses with missing or invalid address lines", async () => {
      const addresses = [
        {
          line: [], // Empty array - invalid
          city: "Los Angeles",
          state: "CA",
        },
        {
          line: ["12"], // Too short - invalid
          city: "Boston",
          state: "MA",
        },
        {
          line: ["123 Main St"],
          city: "New York",
          state: "NY",
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(1);
      expect(result[0]?.city).toBe("New York");
    });

    it("filters out addresses with missing or invalid state", async () => {
      const addresses = [
        {
          line: ["123 Main St"],
          city: "New York",
          state: "NY",
        },
        {
          line: ["456 Oak Ave"],
          city: "Los Angeles",
          state: "", // Empty state - invalid
        },
        {
          line: ["789 Pine St"],
          city: "Chicago",
          state: null, // Null state - invalid
        },
        {
          line: ["101 Elm St"],
          city: "Boston",
          state: "XX", // Invalid state code
        },
        {
          line: ["555 Oak St"],
          city: "Miami",
          state: "invalid state name", // Invalid state name
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(1);
      expect(result[0]?.city).toBe("New York");
    });

    it("filters out addresses with non-string state values", async () => {
      const addresses = [
        {
          line: ["123 Main St"],
          city: "New York",
          state: "NY", // Valid string state
        },
        {
          line: ["456 Oak Ave"],
          city: "Los Angeles",
          state: 123, // Number state - invalid
        },
        {
          line: ["789 Pine St"],
          city: "Chicago",
          state: true, // Boolean state - invalid
        },
        {
          line: ["101 Elm St"],
          city: "Boston",
          state: false, // Boolean state - invalid
        },
        {
          line: ["555 Oak St"],
          city: "Miami",
          state: {}, // Object state - invalid
        },
        {
          line: ["777 Pine St"],
          city: "Seattle",
          state: "WA", // Valid string state
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(2);
      expect(result[0]?.city).toBe("New York");
      expect(result[1]?.city).toBe("Seattle");
    });

    it("returns empty array when all addresses are invalid", async () => {
      const invalidAddresses = [
        {
          line: ["123 Main St"],
          city: "New York",
          state: "invalid state",
        },
        {
          line: [],
          city: "Chicago",
          state: "IL",
        },
        {
          line: ["AB"],
          city: "Boston",
          state: "MA",
        },
      ];

      const result = addressArraySchemaSafe.parse(invalidAddresses);
      expect(result).toHaveLength(0);
    });

    it("returns all addresses when all are valid", async () => {
      const validAddresses = [
        {
          line: ["123 Main St"],
          city: "New York",
          state: "NY",
        },
        {
          line: ["456 Oak Ave"],
          city: "Los Angeles",
          state: "CA",
        },
      ];

      const result = addressArraySchemaSafe.parse(validAddresses);
      expect(result).toHaveLength(2);
      expect(result[0]?.city).toBe("New York");
      expect(result[1]?.city).toBe("Los Angeles");
    });

    it("handles empty array", async () => {
      const result = addressArraySchemaSafe.parse([]);
      expect(result).toHaveLength(0);
    });

    it("handles addresses with multiple valid lines", async () => {
      const addresses = [
        {
          line: ["123 Main St", "Suite 200", "Building A"],
          city: "New York",
          state: "NY",
        },
        {
          line: ["456 Oak Ave"],
          city: "Los Angeles",
          state: "CA",
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(2);
      expect(result[0]?.line).toEqual(["123 Main St", "Suite 200", "Building A"]);
      expect(result[1]?.city).toBe("Los Angeles");
    });

    it("handles addresses with mixed valid and invalid lines", async () => {
      const addresses = [
        {
          line: ["123 Main St", "AB", "Suite 200"], // One valid line is enough
          city: "New York",
          state: "NY",
        },
        {
          line: ["AB", "CD"], // All lines too short - invalid
          city: "Los Angeles",
          state: "CA",
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(1);
      expect(result[0]?.city).toBe("New York");
    });

    it("handles addresses with whitespace in city names", async () => {
      const addresses = [
        {
          line: ["123 Main St"],
          city: "  New York  ", // Should be valid after trimming
          state: "NY",
        },
        {
          line: ["456 Oak Ave"],
          city: "  AB  ", // Too short even after trimming - invalid
          state: "CA",
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(1);
      expect(result[0]?.city).toBe("New York"); // Should be trimmed
    });

    it("handles addresses with whitespace in address lines", async () => {
      const addresses = [
        {
          line: ["  123 Main St  ", "  Suite 200  "],
          city: "New York",
          state: "NY",
        },
        {
          line: ["  456 Oak Ave  "],
          city: "Los Angeles",
          state: "CA",
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(2);
      expect(result[0]?.line).toEqual(["123 Main St", "Suite 200"]); // Should be trimmed
      expect(result[1]?.line).toEqual(["456 Oak Ave"]); // Should be trimmed
    });

    it("handles addresses with additional optional fields", async () => {
      const addresses = [
        {
          line: ["123 Main St"],
          city: "New York",
          state: "NY",
          country: "US",
          postalCode: "10001",
          use: "home",
          type: "physical",
        },
        {
          line: ["456 Oak Ave"],
          city: "Los Angeles",
          state: "invalid state", // Invalid - should be filtered out
          country: "US",
          postalCode: "90210",
        },
        {
          line: ["789 Pine St"],
          city: "Chicago",
          state: "IL",
          country: "US",
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(2);
      expect(result[0]?.city).toBe("New York");
      expect(result[0]?.country).toBe("US");
      expect(result[0]?.postalCode).toBe("10001");
      expect(result[1]?.city).toBe("Chicago");
    });

    it("handles edge case with very short valid city names", async () => {
      const addresses = [
        {
          line: ["123 Main St"],
          city: "NY", // Exactly 2 characters - should be invalid
          state: "NY",
        },
        {
          line: ["789 Pine St"],
          city: "OKC", // 3 characters - should be valid
          state: "OK",
        },
      ];

      const result = addressArraySchemaSafe.parse(addresses);
      expect(result).toHaveLength(1);
      expect(result[0]?.city).toBe("OKC");
    });
  });
});
