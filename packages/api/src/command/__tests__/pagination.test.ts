/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getPaginationItems, Pagination } from "../../command/pagination";

const defaultItemsPerPage = 50;

beforeAll(() => {
  jest.restoreAllMocks();
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("Pagination command", () => {
  describe("getPaginationItems", () => {
    const mockItems = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
      { id: "3", name: "Item 3" },
      { id: "4", name: "Item 4" },
      { id: "5", name: "Item 5" },
    ];

    let getItems: jest.Func;
    let getTotalCount: jest.Func;
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
      getTotalCount = jest.fn(async () => mockItems.length);
    });

    it("returns empty array when no items exist", async () => {
      const emptyGetItems = async () => [];
      const pagination: Pagination = { count: 1 };
      const result = await getPaginationItems(pagination, emptyGetItems, getTotalCount);
      expect(result.prevPageItemId).toBeUndefined();
      expect(result.nextPageItemId).toBeUndefined();
      expect(result.currPageItems).toEqual([]);
    });

    it("returns first page with no from or to item", async () => {
      const pagination: Pagination = { count: 2 };
      const result = await getPaginationItems(pagination, getItems, getTotalCount);
      expect(result.prevPageItemId).toBeUndefined();
      expect(result.nextPageItemId).toEqual(mockItems[2].id);
      expect(result.currPageItems.length).toEqual(2);
      expect(result.currPageItems).toEqual(expect.arrayContaining([mockItems[0], mockItems[1]]));
      expect(result.totalCount).toEqual(mockItems.length);
    });

    it("returns first page with fromItem", async () => {
      const pagination: Pagination = { count: 2, fromItem: mockItems[0].id };
      const result = await getPaginationItems(pagination, getItems, getTotalCount);
      expect(result.prevPageItemId).toBeUndefined();
      expect(result.nextPageItemId).toEqual(mockItems[2].id);
      expect(result.currPageItems.length).toEqual(2);
      expect(result.currPageItems).toEqual(expect.arrayContaining([mockItems[0], mockItems[1]]));
      expect(result.totalCount).toEqual(mockItems.length);
    });

    it("returns first page with toItem", async () => {
      const pagination: Pagination = { count: 2, toItem: mockItems[1].id };
      const result = await getPaginationItems(pagination, getItems, getTotalCount);
      expect(result.prevPageItemId).toBeUndefined();
      expect(result.nextPageItemId).toEqual(mockItems[2].id);
      expect(result.currPageItems.length).toEqual(2);
      expect(result.currPageItems).toEqual(expect.arrayContaining([mockItems[0], mockItems[1]]));
      expect(result.totalCount).toEqual(mockItems.length);
    });

    it("returns second page with fromItem", async () => {
      const pagination: Pagination = { count: 2, fromItem: mockItems[2].id };
      const result = await getPaginationItems(pagination, getItems, getTotalCount);
      expect(result.prevPageItemId).toEqual(mockItems[1].id);
      expect(result.nextPageItemId).toEqual(mockItems[4].id);
      expect(result.currPageItems.length).toEqual(2);
      expect(result.currPageItems).toEqual(expect.arrayContaining([mockItems[2], mockItems[3]]));
    });

    it("returns second page with toItem", async () => {
      const pagination: Pagination = { count: 2, toItem: mockItems[3].id };
      const result = await getPaginationItems(pagination, getItems, getTotalCount);
      expect(result.prevPageItemId).toEqual(mockItems[1].id);
      expect(result.nextPageItemId).toEqual(mockItems[4].id);
      expect(result.currPageItems.length).toEqual(2);
      expect(result.currPageItems).toEqual(expect.arrayContaining([mockItems[2], mockItems[3]]));
    });

    it("does not include totalCount on second page", async () => {
      const pagination: Pagination = { count: 2, fromItem: mockItems[2].id };
      const result = await getPaginationItems(pagination, getItems, getTotalCount);
      expect(result.totalCount).toBeUndefined();
    });

    it("returns second page with fromItem", async () => {
      const pagination: Pagination = { count: 2, fromItem: mockItems[4].id };
      const result = await getPaginationItems(pagination, getItems, getTotalCount);
      expect(result.prevPageItemId).toEqual(mockItems[3].id);
      expect(result.nextPageItemId).toBeUndefined();
      expect(result.currPageItems.length).toEqual(1);
      expect(result.currPageItems).toEqual(expect.arrayContaining([mockItems[4]]));
      expect(result.totalCount).toBeUndefined();
    });
  });
});
