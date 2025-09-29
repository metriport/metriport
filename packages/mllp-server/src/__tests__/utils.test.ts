import { Config } from "@metriport/core/util/config";

// Mock Config methods BEFORE importing the module that uses them
jest.spyOn(Config, "getHl7Base64ScramblerSeed").mockReturnValue("unit-test-seed");
jest.spyOn(Config, "getAWSRegion").mockReturnValue("unit-test-region");
jest.spyOn(Config, "getHl7RawMessageBucketName").mockReturnValue("unit-test-bucket");

// Import after mocking to ensure mocked values are used during module initialization
import { MetriportError } from "@metriport/shared";
import { HieConfigDictionary } from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { lookupHieTzEntryForIp } from "../utils";

describe("lookupHieTzEntryForIp", () => {
  const mockHieConfigDictionary: HieConfigDictionary = {
    hie1: {
      cidrBlocks: ["192.168.1.0/24", "10.0.0.0/16"],
      timezone: "America/New_York",
    },
    hie2: {
      cidrBlocks: ["172.16.0.0/12"],
      timezone: "America/Los_Angeles",
    },
    hie3: {
      // VpnlessHieConfig - should be filtered out by keepOnlyVpnConfigs
      timezone: "America/Chicago",
    },
  };

  describe("successful IP lookup", () => {
    it("should return correct HIE config for IP in first CIDR block", () => {
      const result = lookupHieTzEntryForIp(mockHieConfigDictionary, "192.168.1.100");

      expect(result).toEqual({
        hieName: "hie1",
        cidrBlocks: ["192.168.1.0/24", "10.0.0.0/16"],
        timezone: "America/New_York",
      });
    });

    it("should return correct HIE config for IP at network boundary", () => {
      // Test edge case: first IP in network
      const result1 = lookupHieTzEntryForIp(mockHieConfigDictionary, "192.168.1.1");
      expect(result1.hieName).toBe("hie1");

      // Test edge case: last IP in network
      const result2 = lookupHieTzEntryForIp(mockHieConfigDictionary, "192.168.1.254");
      expect(result2.hieName).toBe("hie1");
    });

    it("should handle /32 CIDR blocks (single IP)", () => {
      const singleIpConfig: HieConfigDictionary = {
        "single-ip-hie": {
          cidrBlocks: ["203.0.113.42/32"],
          timezone: "America/New_York",
        },
      };

      const result = lookupHieTzEntryForIp(singleIpConfig, "203.0.113.42");
      expect(result).toEqual({
        hieName: "single-ip-hie",
        cidrBlocks: ["203.0.113.42/32"],
        timezone: "America/New_York",
      });
    });
  });

  describe("IP not found scenarios", () => {
    it("should throw MetriportError when IP is not in any CIDR block", () => {
      const testIp = "8.8.8.8"; // Public DNS, not in any of our test ranges

      expect(() => {
        lookupHieTzEntryForIp(mockHieConfigDictionary, testIp);
      }).toThrow(MetriportError);
    });

    it("should throw MetriportError when IP is outside CIDR range", () => {
      // 192.168.2.1 is outside 192.168.1.0/24
      expect(() => {
        lookupHieTzEntryForIp(mockHieConfigDictionary, "192.168.2.1");
      }).toThrow(MetriportError);

      // 172.15.255.255 is outside 172.16.0.0/12
      expect(() => {
        lookupHieTzEntryForIp(mockHieConfigDictionary, "172.15.255.255");
      }).toThrow(MetriportError);
    });
  });
});
