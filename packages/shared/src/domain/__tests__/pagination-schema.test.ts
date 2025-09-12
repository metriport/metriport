import { faker } from "@faker-js/faker";
import { encodeCursor } from "../cursor-utils";
import { createQueryMetaSchemaV2 } from "../pagination-v2";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("pagination schema", () => {
  const schema = createQueryMetaSchemaV2();

  describe("sort parameter validation", () => {
    it("accepts valid sort string with multiple fields", () => {
      const query = {
        sort: "createdAt=desc,name=asc,id=asc",
        count: 25,
      };
      const result = schema.parse(query);
      expect(result.sort).toEqual([
        { col: "createdAt", order: "desc" },
        { col: "name", order: "asc" },
        { col: "id", order: "asc" },
      ]);
    });

    it("validates sort parameter formats", () => {
      // Invalid sort order
      expect(() => schema.parse({ sort: "name=invalid", count: 10 })).toThrow(
        "Invalid sort order: invalid. Must be 'asc' or 'desc'"
      );

      // Missing column
      expect(() => schema.parse({ sort: "=asc", count: 10 })).toThrow(
        "Invalid sort format: =asc. Expected: column=order"
      );

      // Missing order
      expect(() => schema.parse({ sort: "name=", count: 10 })).toThrow(
        "Invalid sort format: name=. Expected: column=order"
      );

      // Wrong separator
      expect(() => schema.parse({ sort: "name:asc", count: 10 })).toThrow(
        "Invalid sort format: name:asc. Expected: column=order"
      );
    });

    it("auto-adds id sort only to final sort, not originalSort", () => {
      const query = {
        sort: "name=asc,priority=desc",
        count: 25,
      };
      const result = schema.parse(query);

      // originalSort should contain exactly what user provided (no auto-added ID)
      expect(result.originalSort).toEqual([
        { col: "name", order: "asc" },
        { col: "priority", order: "desc" },
      ]);

      // sort should contain auto-added ID sort
      expect(result.sort).toEqual([
        { col: "name", order: "asc" },
        { col: "priority", order: "desc" },
        { col: "id", order: "desc" },
      ]);
    });

    it("preserves user-provided id sort in both originalSort and sort", () => {
      const query = {
        sort: "name=asc,id=asc",
        count: 25,
      };
      const result = schema.parse(query);

      // Both should contain the user-provided ID sort
      expect(result.originalSort).toEqual([
        { col: "name", order: "asc" },
        { col: "id", order: "asc" },
      ]);

      expect(result.sort).toEqual([
        { col: "name", order: "asc" },
        { col: "id", order: "asc" },
      ]);
    });
  });

  describe("cursor parameter validation and transformation", () => {
    it("transforms complex cursor with multiple string values", () => {
      const cursorData = {
        name: faker.person.fullName(),
        priority: faker.number.int().toString(),
        timestamp: faker.date.recent().toISOString(),
        category: "active",
        id: faker.string.uuid(),
      };
      const encodedCursor = encodeCursor(cursorData);

      const query = {
        fromItem: encodedCursor,
        sort: "name=asc,priority=desc,timestamp=desc,category=asc,id=desc",
        count: 10,
      };

      const result = schema.parse(query);
      expect(result.fromItem).toEqual(cursorData);
      expect(result.sort).toEqual([
        { col: "name", order: "asc" },
        { col: "priority", order: "desc" },
        { col: "timestamp", order: "desc" },
        { col: "category", order: "asc" },
        { col: "id", order: "desc" },
      ]);
    });

    it("rejects invalid base64 cursor", () => {
      const query = {
        fromItem: "invalid-base64!!!",
        count: 10,
      };

      expect(() => schema.parse(query)).toThrow("Invalid cursor: unable to decode cursor");
    });

    it("rejects valid base64 but invalid JSON cursor", () => {
      const invalidJson = Buffer.from("not valid json", "utf8").toString("base64");
      const query = {
        fromItem: invalidJson,
        count: 10,
      };

      expect(() => schema.parse(query)).toThrow();
    });
  });

  describe("complete query validation", () => {
    it("validates complete query with sort and fromItem", () => {
      const cursorData = {
        name: "john",
        createdAt: "2023-12-01T10:00:00Z",
        id: faker.string.uuid(),
      };
      const encodedCursor = encodeCursor(cursorData);

      const query = {
        sort: "name=asc,createdAt=desc,id=asc",
        fromItem: encodedCursor,
        count: 25,
      };

      const result = schema.parse(query);
      expect(result).toEqual({
        sort: [
          { col: "name", order: "asc" },
          { col: "createdAt", order: "desc" },
          { col: "id", order: "asc" },
        ],
        originalSort: [
          { col: "name", order: "asc" },
          { col: "createdAt", order: "desc" },
          { col: "id", order: "asc" },
        ],
        fromItem: cursorData,
        count: 25,
      });
    });

    it("validates complete query with sort and toItem", () => {
      const cursorData = { priority: "5", name: "test", id: faker.string.uuid() };
      const encodedCursor = encodeCursor(cursorData);

      const query = {
        sort: "priority=desc,name=asc,id=asc",
        toItem: encodedCursor,
        count: 50,
      };

      const result = schema.parse(query);
      expect(result).toEqual({
        sort: [
          { col: "priority", order: "asc" },
          { col: "name", order: "desc" },
          { col: "id", order: "desc" },
        ],
        originalSort: [
          { col: "priority", order: "desc" },
          { col: "name", order: "asc" },
          { col: "id", order: "asc" },
        ],
        toItem: cursorData,
        count: 50,
      });
    });
  });
});
