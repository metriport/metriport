/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { faker } from "@faker-js/faker";
import { Pagination } from "../../command/pagination";
import { paginated } from "../pagination";

const defaultItemsPerPage = 50;

beforeAll(() => {
  jest.restoreAllMocks();
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("Pagination", () => {
  describe("paginated", () => {
    const mockItems = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
      { id: "3", name: "Item 3" },
      { id: "4", name: "Item 4" },
      { id: "5", name: "Item 5" },
    ];
    const baseUrl = "/test";

    let getItems: jest.Func;
    beforeEach(() => {
      jest.clearAllMocks();
      getItems = jest.fn(async (pagination: Pagination) => {
        let items = [...mockItems];
        if (pagination.fromItem) {
          items = items.filter(i => i.id >= pagination.fromItem!);
        }
        if (pagination.toItem) {
          items = items.filter(i => i.id <= pagination.toItem!);
        }
        const count = pagination.count ?? defaultItemsPerPage;
        if (pagination.toItem) {
          return items.slice(-count ?? items.length);
        }
        return items.slice(0, count);
      });
    });

    describe("validation", () => {
      it("rejects when both fromItem and toItem provided", () => {
        const req = { query: { fromItem: "1", toItem: "2" }, baseUrl };
        expect(() => paginated(req as any, undefined, getItems)).rejects.toThrow(
          "Either fromItem or toItem can be provided, but not both"
        );
      });

      it("accepts valid count parameter", async () => {
        const req = { query: { count: "10" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.meta.itemsOnPage).toBeLessThanOrEqual(10);
      });

      it("rejects invalid count parameter", () => {
        const req = { query: { count: "invalid" }, baseUrl };
        expect(() => paginated(req as any, undefined, getItems)).rejects.toThrow();
      });

      it("accepts fromItem without toItem", async () => {
        const req = { query: { fromItem: "1" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items[0].id).toBe("1");
      });

      it("accepts toItem without fromItem", async () => {
        const req = { query: { toItem: "5" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items[result.items.length - 1].id).toBe("5");
      });

      it("accepts count equal to limit", async () => {
        const req = { query: { count: "500" }, baseUrl };
        await paginated(req as any, undefined, getItems);
        // One extra since we ask for one more to determine if there is a next page
        expect(getItems).toHaveBeenNthCalledWith(1, { count: 501 });
      });

      it("fails if count is higher than limit", async () => {
        const req = { query: { count: "501" }, baseUrl };
        expect(() => paginated(req as any, undefined, getItems)).rejects.toThrow(
          "Count cannot be greater than 500"
        );
      });
    });

    describe("logic", () => {
      it("returns empty array when no items exist", async () => {
        const emptyGetItems = async () => [];
        const req = { query: {}, baseUrl };
        const result = await paginated(req as any, undefined, emptyGetItems);
        expect(result.items).toHaveLength(0);
        expect(result.meta.nextPage).toBeUndefined();
        expect(result.meta.prevPage).toBeUndefined();
        expect(result.meta.itemsOnPage).toBe(0);
      });

      it("returns single item when only one exists", async () => {
        const id = faker.string.uuid();
        const singleItemGetItems = async () => [{ id, name: "Item 1" }];
        const req = { query: {}, baseUrl };
        const result = await paginated(req as any, undefined, singleItemGetItems);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe(id);
        expect(result.meta.nextPage).toBeUndefined();
        expect(result.meta.prevPage).toBeUndefined();
        expect(result.meta.itemsOnPage).toBe(1);
      });

      it("handles fromItem with no matching items", async () => {
        const req = { query: { fromItem: "999" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items).toHaveLength(0);
        expect(result.meta.nextPage).toBeUndefined();
        expect(result.meta.prevPage).toBeUndefined();
        expect(result.meta.itemsOnPage).toBe(0);
      });

      it("handles toItem with no matching items", async () => {
        const req = { query: { toItem: "0" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items).toHaveLength(0);
        expect(result.meta.nextPage).toBeUndefined();
        expect(result.meta.prevPage).toBeUndefined();
        expect(result.meta.itemsOnPage).toBe(0);
      });

      it("returns correct items when count equals total items", async () => {
        const req = { query: { count: "5" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items).toHaveLength(5);
        expect(result.items[0].id).toBe("1");
        expect(result.items[4].id).toBe("5");
        expect(result.meta.nextPage).toBeUndefined();
        expect(result.meta.prevPage).toBeUndefined();
        expect(result.meta.itemsOnPage).toBe(5);
      });

      it("returns correct items when count exceeds total items", async () => {
        const req = { query: { count: "10" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items).toHaveLength(5);
        expect(result.items[0].id).toBe("1");
        expect(result.items[4].id).toBe("5");
        expect(result.meta.nextPage).toBeUndefined();
        expect(result.meta.prevPage).toBeUndefined();
        expect(result.meta.itemsOnPage).toBe(5);
      });

      it("returns first page when count is lower than total items", async () => {
        const req = { query: { count: "2" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items).toHaveLength(2);
        expect(result.items[0].id).toBe("1");
        expect(result.items[1].id).toBe("2");
        expect(result.meta.nextPage).toContain("fromItem=3");
        expect(result.meta.prevPage).toBeUndefined();
        expect(result.meta.itemsOnPage).toBe(2);
      });

      it("returns second page correctly with fromItem", async () => {
        const req = { query: { fromItem: "3", count: "2" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items).toHaveLength(2);
        expect(result.items[0].id).toBe("3");
        expect(result.items[1].id).toBe("4");
        expect(result.meta.nextPage).toContain("fromItem=5");
        expect(result.meta.prevPage).toContain("toItem=2");
        expect(result.meta.itemsOnPage).toBe(2);
      });

      it("returns last page correctly with fromItem", async () => {
        const req = { query: { fromItem: "5", count: "2" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe("5");
        expect(result.meta.nextPage).toBeUndefined();
        expect(result.meta.prevPage).toContain("toItem=4");
        expect(result.meta.itemsOnPage).toBe(1);
      });

      it("returns previous page when toItem provided", async () => {
        const req = { query: { toItem: "4", count: "2" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items).toHaveLength(2);
        expect(result.items[0].id).toBe("3");
        expect(result.items[1].id).toBe("4");
        expect(result.meta.nextPage).toContain("fromItem=5");
        expect(result.meta.prevPage).toContain("toItem=2");
        expect(result.meta.itemsOnPage).toBe(2);
      });

      it("returns first page when toItem provided", async () => {
        const req = { query: { toItem: "2", count: "2" }, baseUrl };
        const result = await paginated(req as any, undefined, getItems);
        expect(result.items).toHaveLength(2);
        expect(result.items[0].id).toBe("1");
        expect(result.items[1].id).toBe("2");
        expect(result.meta.nextPage).toContain("fromItem=3");
        expect(result.meta.prevPage).toBeUndefined();
        expect(result.meta.itemsOnPage).toBe(2);
      });

      it("defaults to 50 items per page", async () => {
        const moreItemsThanDefaultCount = async () =>
          Array.from({ length: defaultItemsPerPage + 10 }, (_, i) => ({
            id: i.toString(),
            name: `Item ${i}`,
          }));
        const req = { query: {}, baseUrl };
        const result = await paginated(req as any, undefined, moreItemsThanDefaultCount);
        expect(result.items).toHaveLength(defaultItemsPerPage);
        expect(result.meta.itemsOnPage).toBe(defaultItemsPerPage);
      });

      it("returns first page when no pagination params provided", async () => {
        const hundredPlusItems = async () =>
          Array.from({ length: defaultItemsPerPage + 10 }, (_, i) => ({
            id: (++i).toString(),
            name: `Item ${i}`,
          }));
        const req = { query: {}, baseUrl };
        const result = await paginated(req as any, undefined, hundredPlusItems);
        expect(result.items).toHaveLength(defaultItemsPerPage);
        expect(result.items[0].id).toBe("1");
        expect(result.items[1].id).toBe("2");
        expect(result.items[defaultItemsPerPage - 1].id).toBe(defaultItemsPerPage.toString());
        expect(result.meta.nextPage).toContain("fromItem=" + (defaultItemsPerPage + 1));
        expect(result.meta.prevPage).toBeUndefined();
      });

      it("includes count param in next/prev page urls", async () => {
        const req = { query: { fromItem: "3", count: "2" }, baseUrl };
        const additionalQueryParams = { filters: "john doe" };
        const result = await paginated(req as any, additionalQueryParams, getItems);
        expect(result.meta.prevPage).toContain("count=2");
        expect(result.meta.nextPage).toContain("count=2");
      });

      it("includes additional query params in next/prev page urls", async () => {
        const req = { query: { fromItem: "3", count: "2" }, baseUrl };
        const additionalQueryParams = { filters: "john doe" };
        const result = await paginated(req as any, additionalQueryParams, getItems);
        expect(result.meta.prevPage).toContain("filters=john+doe");
        expect(result.meta.nextPage).toContain("filters=john+doe");
      });
    });
  });
});
