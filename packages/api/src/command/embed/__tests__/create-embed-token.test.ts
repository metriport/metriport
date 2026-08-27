import { faker } from "@faker-js/faker";
import {
  embedDashSource,
  maxExpirationSeconds,
} from "@metriport/shared/interface/external/ehr/embed/jwt-token";
import * as jwtTokenCommand from "../../jwt-token";
import * as cxMappingCommand from "../../mapping/cx";
import { createEmbedToken } from "../create-embed-token";

const mockFindOrCreateJwtToken = jest.spyOn(jwtTokenCommand, "findOrCreateJwtToken");
const mockFindOrCreateCxMapping = jest.spyOn(cxMappingCommand, "findOrCreateCxMapping");

describe("createEmbedToken", () => {
  const cxId = faker.string.uuid();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    mockFindOrCreateJwtToken.mockResolvedValue({
      id: faker.string.uuid(),
      token: faker.string.uuid(),
      exp: new Date(),
      source: embedDashSource,
      data: {
        cxId,
        practiceId: cxId,
        source: embedDashSource,
      },
      eTag: faker.string.uuid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockFindOrCreateCxMapping.mockResolvedValue({
      id: faker.string.uuid(),
      cxId,
      source: embedDashSource,
      externalId: cxId,
      secondaryMappings: {},
      eTag: faker.string.uuid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("cx mapping", () => {
    it("creates cx mapping with cxId as externalId", async () => {
      await createEmbedToken({
        cxId,
        expirationInSeconds: maxExpirationSeconds,
      });

      expect(mockFindOrCreateCxMapping).toHaveBeenCalledWith({
        cxId,
        source: embedDashSource,
        externalId: cxId,
        secondaryMappings: {},
      });
    });
  });

  describe("expiration", () => {
    it("uses provided expiration seconds", async () => {
      await createEmbedToken({
        cxId,
        expirationInSeconds: maxExpirationSeconds,
      });

      expect(mockFindOrCreateJwtToken).toHaveBeenCalledWith(
        expect.objectContaining({
          exp: new Date("2024-01-01T10:00:00.000Z"),
        })
      );
    });

    it("uses custom expiration when specified", async () => {
      const customExpirationSeconds = 3600;

      await createEmbedToken({
        cxId,
        expirationInSeconds: customExpirationSeconds,
      });

      expect(mockFindOrCreateJwtToken).toHaveBeenCalledWith(
        expect.objectContaining({
          exp: new Date("2024-01-01T01:00:00.000Z"),
        })
      );
    });
  });

  describe("token result", () => {
    it("returns token in result", async () => {
      const result = await createEmbedToken({
        cxId,
        expirationInSeconds: maxExpirationSeconds,
      });

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
    });

    it("stores token with correct data", async () => {
      await createEmbedToken({
        cxId,
        expirationInSeconds: maxExpirationSeconds,
      });

      expect(mockFindOrCreateJwtToken).toHaveBeenCalledWith({
        token: expect.any(String),
        exp: expect.any(Date),
        source: embedDashSource,
        data: {
          cxId,
          practiceId: cxId,
          source: embedDashSource,
        },
      });
    });
  });
});
