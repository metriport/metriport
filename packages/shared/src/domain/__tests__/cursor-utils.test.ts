import { faker } from "@faker-js/faker";
import { encodeCursor, decodeCursor, createCompositeCursor } from "../cursor-utils";
import { SortItem } from "../pagination-v2";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("cursor-utils", () => {
  describe("encodeCursor", () => {
    it("returns encoded string when given empty object", () => {
      const cursor = {};
      const encoded = encodeCursor(cursor);
      expect(encoded).toBe("e30="); // base64 for '{}'
    });

    it("encodes simple cursor object", () => {
      const cursor = { id: "123" };
      const encoded = encodeCursor(cursor);
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
      expect(decoded).toEqual(cursor);
    });

    it("encodes complex cursor with multiple fields and types", () => {
      const cursor = {
        name: "john doe",
        createdAt: "2023-12-01T10:00:00Z",
        priority: 5,
        isActive: true,
        id: "uuid-123",
      };
      const encoded = encodeCursor(cursor);
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
      expect(decoded).toEqual(cursor);
    });

    it("handles special characters in cursor values", () => {
      const cursor = {
        name: "João da Silva & Co.",
        notes: "Test with 🦄 emojis and\nnewlines",
      };
      const encoded = encodeCursor(cursor);
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
      expect(decoded).toEqual(cursor);
    });

    it("handles null and undefined values", () => {
      const cursor = {
        name: null,
        description: undefined,
        id: "123",
      };
      const encoded = encodeCursor(cursor);
      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
      expect(decoded).toEqual({ name: null, id: "123" }); // undefined gets removed by JSON
    });
  });

  describe("decodeCursor", () => {
    it("decodes empty object cursor", () => {
      const encoded = "e30="; // base64 for '{}'
      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual({});
    });

    it("decodes simple cursor", () => {
      const original = { id: "123" };
      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual(original);
    });

    it("decodes complex cursor with multiple types", () => {
      const original = {
        name: "test user",
        timestamp: "2023-12-01T10:00:00Z",
        count: 42,
        isEnabled: false,
      };
      const encoded = encodeCursor(original);
      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual(original);
    });

    it("throws error for invalid base64", () => {
      const invalidBase64 = "not-valid-base64!!!";
      expect(() => decodeCursor(invalidBase64)).toThrow();
    });

    it("throws error for valid base64 but invalid JSON", () => {
      const validBase64 = Buffer.from("invalid json", "utf8").toString("base64");
      expect(() => decodeCursor(validBase64)).toThrow();
    });

    it("throws error for empty string", () => {
      expect(() => decodeCursor("")).toThrow();
    });
  });

  describe("encode and decode together", () => {
    it("roundtrip preserves empty object", () => {
      const original = {};
      const roundtrip = decodeCursor(encodeCursor(original));
      expect(roundtrip).toEqual(original);
    });

    it("roundtrip preserves simple object", () => {
      const original = { id: faker.string.uuid() };
      const roundtrip = decodeCursor(encodeCursor(original));
      expect(roundtrip).toEqual(original);
    });

    it("roundtrip preserves complex object", () => {
      const original = {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        age: faker.number.int({ min: 18, max: 100 }),
        createdAt: faker.date.recent().toISOString(),
        isActive: faker.datatype.boolean(),
      };
      const roundtrip = decodeCursor(encodeCursor(original));
      expect(roundtrip).toEqual(original);
    });

    it("roundtrip handles special characters", () => {
      const original = {
        unicode: "🦄🌟⭐",
        multiline: "line1\nline2\r\nline3",
        quotes: 'single "double" quotes',
        special: "& < > ' \"",
      };
      const roundtrip = decodeCursor(encodeCursor(original));
      expect(roundtrip).toEqual(original);
    });
  });

  describe("createCompositeCursor", () => {
    const mockSortFields: SortItem[] = [
      { col: "name", order: "asc" },
      { col: "createdAt", order: "desc" },
      { col: "id", order: "asc" },
    ];

    it("creates cursor with all sort fields from item", () => {
      const item = {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        createdAt: faker.date.recent().toISOString(),
        email: faker.internet.email(),
        age: faker.number.int(),
      };

      const cursor = createCompositeCursor(item, mockSortFields);

      expect(cursor).toEqual({
        name: item.name,
        createdAt: item.createdAt,
        id: item.id,
      });
      expect(cursor).not.toHaveProperty("email");
      expect(cursor).not.toHaveProperty("age");
    });

    it("creates cursor with subset of fields when item missing some sort fields", () => {
      const item = {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
        // missing createdAt
        email: faker.internet.email(),
      };

      const cursor = createCompositeCursor(item, mockSortFields);

      expect(cursor).toEqual({
        name: item.name,
        createdAt: undefined,
        id: item.id,
      });
    });

    it("creates empty cursor for empty sort fields", () => {
      const item = {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
      };

      const cursor = createCompositeCursor(item, []);
      expect(cursor).toEqual({});
    });

    it("handles null and undefined values in item", () => {
      const item = {
        id: faker.string.uuid(),
        name: null,
        createdAt: undefined,
        status: "active",
      };

      const cursor = createCompositeCursor(item, mockSortFields);

      expect(cursor).toEqual({
        name: null,
        createdAt: undefined,
        id: item.id,
      });
    });

    it("works with single sort field", () => {
      const item = {
        id: faker.string.uuid(),
        name: faker.person.fullName(),
      };
      const singleSortField: SortItem[] = [{ col: "name", order: "asc" }];

      const cursor = createCompositeCursor(item, singleSortField);

      expect(cursor).toEqual({
        name: item.name,
      });
    });

    it("preserves different data types in cursor", () => {
      const item = {
        id: faker.string.uuid(),
        count: faker.number.int(),
        price: faker.number.float(),
        isActive: faker.datatype.boolean(),
        createdAt: faker.date.recent(),
      };
      const sortFields: SortItem[] = [
        { col: "count", order: "desc" },
        { col: "price", order: "asc" },
        { col: "isActive", order: "desc" },
        { col: "createdAt", order: "asc" },
      ];

      const cursor = createCompositeCursor(item, sortFields);

      expect(cursor).toEqual({
        count: item.count,
        price: item.price,
        isActive: item.isActive,
        createdAt: item.createdAt,
      });
    });
  });
});
