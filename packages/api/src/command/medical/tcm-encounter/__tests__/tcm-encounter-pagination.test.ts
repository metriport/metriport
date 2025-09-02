import { faker } from "@faker-js/faker";
import { PatientModel } from "../../../../models/medical/patient";
import { TcmEncounterModel } from "../../../../models/medical/tcm-encounter";
import { makePaginationWithCursor } from "../../__tests__/fixtures";
import { getTcmEncounters, getTcmEncountersCount } from "../get-tcm-encounters";

jest.mock("../../../../models/medical/tcm-encounter");
jest.mock("../../../../models/medical/patient");

describe("TCM encounters pagination", () => {
  const mockSequelize = {
    query: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup model mocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TcmEncounterModel as any).sequelize = mockSequelize;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (TcmEncounterModel as any).tableName = "tcm_encounter";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PatientModel as any).tableName = "patient";
  });

  describe("getTcmEncounters & getTcmEncountersCount", () => {
    it("are both called with the same key query pagination and filter clauses", async () => {
      const cxId = faker.string.uuid();
      const afterDate = faker.date.past().toISOString();
      const pagination = makePaginationWithCursor();

      mockSequelize.query.mockResolvedValueOnce([]);
      await getTcmEncounters({ cxId, pagination, after: afterDate });

      mockSequelize.query.mockResolvedValueOnce([{ count: 0 }]);
      await getTcmEncountersCount({ cxId, after: afterDate });

      const [dataQuery] = mockSequelize.query.mock.calls[0];
      expect(dataQuery).toContain("tcm_encounter.cx_id = :cxId");
      expect(dataQuery).toContain("tcm_encounter.admit_time > :admittedAfter");
      expect(dataQuery).toContain("tcm_encounter.id >= :toItem");
      expect(dataQuery).toContain("ORDER BY tcm_encounter.id ASC");
      expect(dataQuery).toContain("LIMIT :count");

      const [countQuery] = mockSequelize.query.mock.calls[1];
      expect(countQuery).toContain("tcm_encounter.cx_id = :cxId");
      expect(countQuery).toContain("tcm_encounter.admit_time > :admittedAfter");
    });
  });
});
