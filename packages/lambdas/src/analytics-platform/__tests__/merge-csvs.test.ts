/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { FileInfo, groupFilesByTypeAndSize } from "../merge-csvs";

describe("groupFilesByTypeAndSize", () => {
  describe("file uniqueness constraints", () => {
    it("should ensure each file appears in exactly one group", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 60 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient3/condition.csv", size: 40 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient1/patient.csv", size: 30 * 1024 * 1024, tableName: "patient" },
        { key: "path/patient2/patient.csv", size: 35 * 1024 * 1024, tableName: "patient" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      // Check that all files are present in exactly one group
      const allFilesInGroups = groups.flatMap(group => group.files);
      expect(allFilesInGroups).toHaveLength(files.length);

      // Check that each original file appears exactly once
      files.forEach(file => {
        const occurrences = allFilesInGroups.filter(f => f.key === file.key);
        expect(occurrences).toHaveLength(1);
      });
    });

    it("should not allow duplicate files across groups", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 60 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient3/condition.csv", size: 40 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      // Check that no file appears in multiple groups
      const allFileKeys = groups.flatMap(group => group.files.map(f => f.key));
      const uniqueFileKeys = new Set(allFileKeys);
      expect(allFileKeys).toHaveLength(uniqueFileKeys.size);
    });
  });

  describe("grouping by table type", () => {
    it("should group files by table name correctly", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 60 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient1/patient.csv", size: 30 * 1024 * 1024, tableName: "patient" },
        { key: "path/patient2/patient.csv", size: 35 * 1024 * 1024, tableName: "patient" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      const conditionGroups = groups.filter(g => g.tableName === "condition");
      const patientGroups = groups.filter(g => g.tableName === "patient");

      expect(conditionGroups.length).toBeGreaterThan(0);
      expect(patientGroups.length).toBeGreaterThan(0);

      // All files in condition groups should be condition files
      conditionGroups.forEach(group => {
        group.files.forEach(file => {
          expect(file.tableName).toBe("condition");
        });
      });

      // All files in patient groups should be patient files
      patientGroups.forEach(group => {
        group.files.forEach(file => {
          expect(file.tableName).toBe("patient");
        });
      });
    });

    it("should handle files with empty table names", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/invalid.csv", size: 60 * 1024 * 1024, tableName: "" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      // Files with empty table names should be grouped separately
      const emptyTableGroups = groups.filter(g => g.tableName === "");
      expect(emptyTableGroups.length).toBeGreaterThan(0);
    });
  });

  describe("large file handling", () => {
    it("should create individual groups for files larger than target size", () => {
      const largeFileSize = 150 * 1024 * 1024; // 150MB, larger than 100MB target
      const files = [
        { key: "path/patient1/condition.csv", size: largeFileSize, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      expect(groups.length).toBe(2);
      // Large file should get its own group
      const largeFileGroup = groups.find(
        g => g.files.length === 1 && g.files[0]?.size === largeFileSize
      );
      expect(largeFileGroup).toBeDefined();
      expect(largeFileGroup!.totalSize).toBe(largeFileSize);
    });

    it("should handle multiple large files correctly", () => {
      const largeFileSize = 150 * 1024 * 1024; // 150MB
      const files = [
        { key: "path/patient1/condition.csv", size: largeFileSize, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: largeFileSize, tableName: "condition" },
        { key: "path/patient3/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      // Each large file should get its own group
      const largeFileGroups = groups.filter(
        g => g.files.length === 1 && g.files[0]?.size === largeFileSize
      );
      expect(largeFileGroups).toHaveLength(2);

      // Check that large files are in separate groups
      const largeFileKeys = largeFileGroups.flatMap(g => g.files.map(f => f.key));
      expect(new Set(largeFileKeys).size).toBe(2);
    });
  });

  describe("small file distribution", () => {
    it("should distribute small files across groups evenly", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 30 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 25 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient3/condition.csv", size: 35 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient4/condition.csv", size: 20 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      // Should create multiple groups for better distribution
      expect(groups.length).toBeGreaterThan(1);

      // Check that files are distributed (not all in one group)
      const groupSizes = groups.map(g => g.files.length);
      expect(Math.max(...groupSizes)).toBeLessThan(files.length);
    });

    it("should balance group sizes when distributing small files", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 40 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 45 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient3/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient4/condition.csv", size: 35 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      // Check that groups are reasonably balanced
      const groupSizes = groups.map(g => g.totalSize);
      const maxSize = Math.max(...groupSizes);
      const minSize = Math.min(...groupSizes);

      // Size difference between largest and smallest group should be reasonable
      expect(maxSize - minSize).toBeLessThan(50 * 1024 * 1024); // Less than 50MB difference
    });
  });

  describe("edge cases", () => {
    it("should handle empty file list", () => {
      const files: FileInfo[] = [];
      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target
      expect(groups).toHaveLength(0);
    });

    it("should handle single file", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
      ];
      const expectedKey = files[0]?.key;
      if (!expectedKey) throw new Error("Programming error: expectedKey is undefined");

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target
      expect(groups).toHaveLength(1);
      expect(groups[0]?.files).toHaveLength(1);
      expect(groups[0]?.files[0]?.key).toBe(expectedKey);
    });

    it("should handle files with zero size", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 0, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      // Zero-size files should still be processed
      const allFiles = groups.flatMap(g => g.files);
      expect(allFiles.some(f => f.size === 0)).toBe(true);
    });

    it("should handle very large target group size", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 60 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 1000); // 1GB target

      // All files should be in one group since they're much smaller than target
      expect(groups).toHaveLength(1);
      expect(groups[0]!.files).toHaveLength(2);
    });
  });

  describe("group ID generation", () => {
    it("should generate unique group IDs", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 60 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient1/patient.csv", size: 30 * 1024 * 1024, tableName: "patient" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      const groupIds = groups.map(g => g.groupId);
      const uniqueGroupIds = new Set(groupIds);

      expect(groupIds).toHaveLength(uniqueGroupIds.size);
    });

    it("should generate group IDs with correct format", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 60 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      groups.forEach(group => {
        expect(group.groupId).toMatch(/^condition_\d+$/);
        expect(group.tableName).toBe("condition");
      });
    });
  });

  describe("total size calculation", () => {
    it("should calculate total size correctly for each group", () => {
      const files = [
        { key: "path/patient1/condition.csv", size: 30 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 40 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient3/condition.csv", size: 50 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      groups.forEach(group => {
        const expectedTotalSize = group.files.reduce((sum, file) => sum + file.size, 0);
        expect(group.totalSize).toBe(expectedTotalSize);
      });
    });

    it("should handle mixed large and small files correctly", () => {
      const largeFileSize = 150 * 1024 * 1024; // 150MB
      const files = [
        { key: "path/patient1/condition.csv", size: largeFileSize, tableName: "condition" },
        { key: "path/patient2/condition.csv", size: 30 * 1024 * 1024, tableName: "condition" },
        { key: "path/patient3/condition.csv", size: 40 * 1024 * 1024, tableName: "condition" },
      ];

      const groups = groupFilesByTypeAndSize(files, 100); // 100MB target

      // Large file group should have correct total size
      const largeFileGroup = groups.find(g => g.files.some(f => f.size === largeFileSize));
      expect(largeFileGroup).toBeDefined();
      expect(largeFileGroup!.totalSize).toBe(largeFileSize);

      // Small files group should have correct total size
      const smallFilesGroup = groups.find(g => g.files.every(f => f.size < largeFileSize));
      if (smallFilesGroup) {
        const expectedSmallFilesSize = smallFilesGroup.files.reduce(
          (sum, file) => sum + file.size,
          0
        );
        expect(smallFilesGroup.totalSize).toBe(expectedSmallFilesSize);
      }
    });
  });
});
