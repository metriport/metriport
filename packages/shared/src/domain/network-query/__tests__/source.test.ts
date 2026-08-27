import {
  datasourceEntryToError,
  DatasourceQueryEntry,
  DatasourceQueryStatus,
  deriveNetworkQueryStatus,
  getSpecificSource,
  hieSource,
  labSource,
  NetworkQueryProgress,
  NetworkQueryStatus,
  pharmacySource,
  SourceQueryProgress,
  toNetworkQueryStatusDto,
} from "../source";

describe("network-query source", () => {
  const mockRequestId = "test-request-id-123";
  const mockCreatedAt = new Date("2024-01-01T10:00:00Z");
  const mockCompletedAt = new Date("2024-01-01T10:05:00Z");

  describe("deriveNetworkQueryStatus", () => {
    it("should return processing when any source is processing", () => {
      const statuses = [
        DatasourceQueryStatus.Requested,
        DatasourceQueryStatus.Completed,
        DatasourceQueryStatus.Failed,
      ];

      const result = deriveNetworkQueryStatus(statuses);

      expect(result).toBe("processing");
    });

    it("should return completed when all sources completed", () => {
      const statuses = [
        DatasourceQueryStatus.Completed,
        DatasourceQueryStatus.Completed,
        DatasourceQueryStatus.Completed,
      ];

      const result = deriveNetworkQueryStatus(statuses);

      expect(result).toBe("completed");
    });

    it("should return failed when all sources failed", () => {
      const statuses = [
        DatasourceQueryStatus.Failed,
        DatasourceQueryStatus.Failed,
        DatasourceQueryStatus.Failed,
      ];

      const result = deriveNetworkQueryStatus(statuses);

      expect(result).toBe("failed");
    });

    it("should return partial when mixed completed and failed", () => {
      const statuses = [
        DatasourceQueryStatus.Completed,
        DatasourceQueryStatus.Failed,
        DatasourceQueryStatus.Completed,
      ];

      const result = deriveNetworkQueryStatus(statuses);

      expect(result).toBe("partial");
    });

    // Should we actually be throwing an error here instead of returning processing?
    it("should handle empty array edge case", () => {
      const result = deriveNetworkQueryStatus([]);

      expect(result).toBe("processing");
    });

    it("should return processing when any status is initialized", () => {
      const statuses = [DatasourceQueryStatus.Initialized, DatasourceQueryStatus.Completed];

      const result = deriveNetworkQueryStatus(statuses);

      expect(result).toBe("processing");
    });

    it("should return processing when any status is on-roster", () => {
      const statuses = [DatasourceQueryStatus.OnRoster, DatasourceQueryStatus.Failed];

      const result = deriveNetworkQueryStatus(statuses);

      expect(result).toBe("processing");
    });

    it("should return processing when any status is converted", () => {
      const statuses = [DatasourceQueryStatus.Converted, DatasourceQueryStatus.Completed];

      const result = deriveNetworkQueryStatus(statuses);

      expect(result).toBe("processing");
    });
  });

  describe("aggregateSourcesByType via toNetworkQueryStatusDto", () => {
    it("should omit completedAt for single processing source", () => {
      const sources: SourceQueryProgress[] = [
        {
          type: pharmacySource,
          specificSource: getSpecificSource(pharmacySource),
          status: DatasourceQueryStatus.Requested,
          startedAt: mockCreatedAt,
          requestId: mockRequestId,
        },
      ];

      const progress: NetworkQueryProgress & {
        requestId: string;
        status: NetworkQueryStatus;
      } = {
        sources,
        requestId: mockRequestId,
        status: "processing",
      };

      const result = toNetworkQueryStatusDto(progress);

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]?.completedAt).toBeUndefined();
    });

    it("should include latest completedAt when all sources of same type have completedAt", () => {
      const earlierCompletedAt = new Date("2024-01-01T10:05:00Z");
      const laterCompletedAt = new Date("2024-01-01T10:10:00Z");

      const sources: SourceQueryProgress[] = [
        {
          type: pharmacySource,
          specificSource: "surescripts",
          status: DatasourceQueryStatus.Completed,
          startedAt: mockCreatedAt,
          completedAt: earlierCompletedAt,
          requestId: mockRequestId,
        },
        {
          type: pharmacySource,
          specificSource: "ncpdp",
          status: DatasourceQueryStatus.Completed,
          startedAt: mockCreatedAt,
          completedAt: laterCompletedAt,
          requestId: mockRequestId,
        },
      ];

      const progress: NetworkQueryProgress & {
        requestId: string;
        status: NetworkQueryStatus;
      } = {
        sources,
        requestId: mockRequestId,
        status: "completed",
      };

      const result = toNetworkQueryStatusDto(progress);

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]?.type).toBe(pharmacySource);
      expect(result.sources[0]?.completedAt).toEqual(laterCompletedAt);
    });

    it("should omit completedAt when some sources of same type are missing completedAt", () => {
      const sources: SourceQueryProgress[] = [
        {
          type: labSource,
          specificSource: "quest",
          status: DatasourceQueryStatus.Completed,
          startedAt: mockCreatedAt,
          completedAt: mockCompletedAt,
          requestId: mockRequestId,
        },
        {
          type: labSource,
          // NOTE(2026-01-25): We don't support labcorp right now, this is just to guard against a future case where we have multiple specific sources for a data type.
          specificSource: "labcorp",
          status: DatasourceQueryStatus.Requested,
          startedAt: mockCreatedAt,
          requestId: mockRequestId,
        },
      ];

      const progress: NetworkQueryProgress & {
        requestId: string;
        status: NetworkQueryStatus;
      } = {
        sources,
        requestId: mockRequestId,
        status: "processing",
      };

      const result = toNetworkQueryStatusDto(progress);

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]?.type).toBe(labSource);
      expect(result.sources[0]?.completedAt).toBeUndefined();
    });

    it("should use earliest startedAt when aggregating multiple sources", () => {
      const earlierStartedAt = new Date("2024-01-01T09:00:00Z");
      const laterStartedAt = new Date("2024-01-01T10:00:00Z");

      const sources: SourceQueryProgress[] = [
        {
          type: labSource,
          specificSource: "quest",
          status: DatasourceQueryStatus.Completed,
          startedAt: laterStartedAt,
          completedAt: mockCompletedAt,
          requestId: mockRequestId,
        },
        {
          type: labSource,
          specificSource: "labcorp",
          status: DatasourceQueryStatus.Completed,
          startedAt: earlierStartedAt,
          completedAt: mockCompletedAt,
          requestId: mockRequestId,
        },
      ];

      const progress: NetworkQueryProgress & {
        requestId: string;
        status: NetworkQueryStatus;
      } = {
        sources,
        requestId: mockRequestId,
        status: "completed",
      };

      const result = toNetworkQueryStatusDto(progress);

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]?.startedAt).toEqual(earlierStartedAt);
    });

    it("should handle multiple different source types", () => {
      const sources: SourceQueryProgress[] = [
        {
          type: hieSource,
          specificSource: getSpecificSource(hieSource),
          status: DatasourceQueryStatus.Completed,
          startedAt: mockCreatedAt,
          completedAt: mockCompletedAt,
          requestId: mockRequestId,
        },
        {
          type: pharmacySource,
          specificSource: getSpecificSource(pharmacySource),
          status: DatasourceQueryStatus.Completed,
          startedAt: mockCreatedAt,
          completedAt: mockCompletedAt,
          requestId: mockRequestId,
        },
        {
          type: labSource,
          specificSource: getSpecificSource(labSource),
          status: DatasourceQueryStatus.Requested,
          startedAt: mockCreatedAt,
          requestId: mockRequestId,
        },
      ];

      const progress: NetworkQueryProgress & {
        requestId: string;
        status: NetworkQueryStatus;
      } = {
        sources,
        requestId: mockRequestId,
        status: "processing",
      };

      const result = toNetworkQueryStatusDto(progress);

      expect(result.sources).toHaveLength(3);
      expect(result.sources.find(s => s.type === hieSource)?.completedAt).toEqual(mockCompletedAt);
      expect(result.sources.find(s => s.type === pharmacySource)?.completedAt).toEqual(
        mockCompletedAt
      );
      expect(result.sources.find(s => s.type === labSource)?.completedAt).toBeUndefined();
    });
  });

  describe("datasourceEntryToError", () => {
    it("should return error when data.error exists", () => {
      const entry: DatasourceQueryEntry = {
        source: hieSource,
        specificSource: getSpecificSource(hieSource),
        status: DatasourceQueryStatus.Failed,
        createdAt: mockCreatedAt,
        data: {
          error: {
            httpStatus: 400,
            timestamp: "2024-01-01T10:05:00Z",
            message: "Access not enabled",
          },
        },
      };

      const result = datasourceEntryToError(entry);

      expect(result).toBeDefined();
      expect(result?.source).toBe(hieSource);
      expect(result?.httpStatus).toBe(400);
      expect(result?.timestamp).toBe("2024-01-01T10:05:00Z");
      expect(result?.message).toBe("Access not enabled");
    });

    it("should return undefined when data.error is missing", () => {
      const entry: DatasourceQueryEntry = {
        source: pharmacySource,
        specificSource: getSpecificSource(pharmacySource),
        status: DatasourceQueryStatus.Completed,
        createdAt: mockCreatedAt,
        data: {
          metadata: { foo: "bar" },
        },
      };

      const result = datasourceEntryToError(entry);

      expect(result).toBeUndefined();
    });

    it("should return undefined when data is undefined", () => {
      const entry: DatasourceQueryEntry = {
        source: labSource,
        specificSource: getSpecificSource(labSource),
        status: DatasourceQueryStatus.Requested,
        createdAt: mockCreatedAt,
      };

      const result = datasourceEntryToError(entry);

      expect(result).toBeUndefined();
    });
  });

  describe("network query response payload structure", () => {
    it("should return complete NetworkQueryStatusDto structure with processing status", () => {
      const sources: SourceQueryProgress[] = [
        {
          type: hieSource,
          specificSource: getSpecificSource(hieSource),
          status: DatasourceQueryStatus.Requested,
          startedAt: mockCreatedAt,
          requestId: mockRequestId,
        },
        {
          type: pharmacySource,
          specificSource: getSpecificSource(pharmacySource),
          status: DatasourceQueryStatus.Completed,
          startedAt: mockCreatedAt,
          completedAt: mockCompletedAt,
          requestId: mockRequestId,
        },
      ];

      const progress: NetworkQueryProgress & {
        requestId: string;
        status: NetworkQueryStatus;
      } = {
        sources,
        requestId: mockRequestId,
        status: "processing",
      };

      const result = toNetworkQueryStatusDto(progress);

      // Verify top-level structure
      expect(result).toMatchObject({
        requestId: expect.any(String),
        status: expect.stringMatching(/^(processing|completed|partial|failed)$/),
        sources: expect.any(Array),
      });

      expect(result.requestId).toBe(mockRequestId);
      expect(result.status).toBe("processing");
      expect(result.sources).toHaveLength(2);

      // Verify each source has correct structure
      result.sources.forEach(source => {
        expect(source).toMatchObject({
          type: expect.stringMatching(/^(hie|pharmacy|lab)$/),
          status: expect.stringMatching(/^(processing|completed|failed)$/),
          startedAt: expect.any(Date),
        });
      });

      // Verify HIE source (processing, no completedAt)
      const hieSourceResult = result.sources.find(s => s.type === hieSource);
      expect(hieSourceResult).toBeDefined();
      expect(hieSourceResult?.status).toBe("processing");
      expect(hieSourceResult?.completedAt).toBeUndefined();
      if (hieSourceResult) {
        expect("completedAt" in hieSourceResult).toBe(false);
      }

      // Verify pharmacy source (completed, has completedAt)
      const pharmacySourceResult = result.sources.find(s => s.type === pharmacySource);
      expect(pharmacySourceResult).toBeDefined();
      expect(pharmacySourceResult?.status).toBe("completed");
      expect(pharmacySourceResult?.completedAt).toEqual(mockCompletedAt);
      if (pharmacySourceResult) {
        expect("completedAt" in pharmacySourceResult).toBe(true);
      }
    });

    it("should return complete NetworkQueryStatusDto structure with errors array", () => {
      const sources: SourceQueryProgress[] = [
        {
          type: hieSource,
          specificSource: getSpecificSource(hieSource),
          status: DatasourceQueryStatus.Completed,
          startedAt: mockCreatedAt,
          completedAt: mockCompletedAt,
          requestId: mockRequestId,
        },
        {
          type: pharmacySource,
          specificSource: getSpecificSource(pharmacySource),
          status: DatasourceQueryStatus.Failed,
          startedAt: mockCreatedAt,
          requestId: mockRequestId,
        },
        {
          type: labSource,
          specificSource: getSpecificSource(labSource),
          status: DatasourceQueryStatus.Failed,
          startedAt: mockCreatedAt,
          requestId: mockRequestId,
        },
      ];

      const progress: NetworkQueryProgress & {
        requestId: string;
        status: NetworkQueryStatus;
        errors: Array<{
          source: typeof pharmacySource | typeof labSource;
          httpStatus: number;
          message: string;
          timestamp: string;
        }>;
      } = {
        sources,
        requestId: mockRequestId,
        status: "partial",
        errors: [
          {
            source: pharmacySource,
            httpStatus: 400,
            message: "Pharmacy access not enabled for this customer",
            timestamp: "2024-01-01T10:00:00Z",
          },
          {
            source: labSource,
            httpStatus: 500,
            message: "Internal error querying lab source",
            timestamp: "2024-01-01T10:00:01Z",
          },
        ],
      };

      const result = toNetworkQueryStatusDto(progress);

      // Verify top-level structure includes errors
      expect(result).toMatchObject({
        requestId: mockRequestId,
        status: "partial",
        sources: expect.any(Array),
        errors: expect.any(Array),
      });

      // Should have all three sources in the sources array
      expect(result.sources).toHaveLength(3);

      // Verify completed source
      const hieSourceResult = result.sources.find(s => s.type === hieSource);
      expect(hieSourceResult).toMatchObject({
        type: hieSource,
        status: "completed",
        completedAt: mockCompletedAt,
      });

      // Verify failed pharmacy source is in sources array
      const pharmacySourceResult = result.sources.find(s => s.type === pharmacySource);
      expect(pharmacySourceResult).toMatchObject({
        type: pharmacySource,
        status: "failed",
        startedAt: mockCreatedAt,
      });
      expect(pharmacySourceResult?.completedAt).toBeUndefined();

      // Verify failed lab source is in sources array
      const labSourceResult = result.sources.find(s => s.type === labSource);
      expect(labSourceResult).toMatchObject({
        type: labSource,
        status: "failed",
        startedAt: mockCreatedAt,
      });
      expect(labSourceResult?.completedAt).toBeUndefined();

      // Verify errors array has error details
      expect(result.errors).toHaveLength(2);

      // Verify error structure
      result.errors?.forEach(error => {
        expect(error).toMatchObject({
          source: expect.stringMatching(/^(hie|pharmacy|lab)$/),
          httpStatus: expect.any(Number),
          message: expect.any(String),
          timestamp: expect.any(String),
        });
      });

      // Verify specific errors
      const pharmacyError = result.errors?.find(e => e.source === pharmacySource);
      expect(pharmacyError).toEqual({
        source: pharmacySource,
        httpStatus: 400,
        message: "Pharmacy access not enabled for this customer",
        timestamp: "2024-01-01T10:00:00Z",
      });

      const labError = result.errors?.find(e => e.source === labSource);
      expect(labError).toEqual({
        source: labSource,
        httpStatus: 500,
        message: "Internal error querying lab source",
        timestamp: "2024-01-01T10:00:01Z",
      });
    });

    it("should omit errors field when no errors exist", () => {
      const sources: SourceQueryProgress[] = [
        {
          type: hieSource,
          specificSource: getSpecificSource(hieSource),
          status: DatasourceQueryStatus.Completed,
          startedAt: mockCreatedAt,
          completedAt: mockCompletedAt,
          requestId: mockRequestId,
        },
      ];

      const progress: NetworkQueryProgress & {
        requestId: string;
        status: NetworkQueryStatus;
      } = {
        sources,
        requestId: mockRequestId,
        status: "completed",
      };

      const result = toNetworkQueryStatusDto(progress);

      expect(result).toMatchObject({
        requestId: mockRequestId,
        status: "completed",
        sources: expect.any(Array),
      });

      expect(result.errors).toBeUndefined();
      expect("errors" in result).toBe(false);
    });
  });
});
