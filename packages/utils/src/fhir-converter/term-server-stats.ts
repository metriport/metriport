import fs from "fs";
import path from "path";
import * as xml2js from "xml2js";
import { codeSystemMapping } from "./term-server";

interface Stats {
  codeOccurrences: { [code: string]: number };
  totalFiles: number;
  tagsWithTranslation: number;
  totalTagsChecked: number;
  tagsWithCodeNoDisplayNameThroughout: number;
  tagsWithDisplayNameButNoCode: number;
  terminologyStats: {
    [key: string]: {
      totalTagsChecked: number;
      tagsWithCodeNoDisplayNameThroughout: number;
      tagsWithDisplayNameButNoCode: number;
    };
  };
}

interface Translation {
  $: {
    codeSystem: string;
    displayName?: string;
  };
}

const parser = new xml2js.Parser({});

async function checkXmlFile(filePath: string, stats: Stats): Promise<void> {
  const content = fs.readFileSync(filePath, "utf8");
  try {
    const result = await parser.parseStringPromise(content);

    const tags = ["code", "valueCode", "value"]; // Tags to check
    tags.forEach(tag => {
      findTags(result, tag, stats);
    });
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
  }
}
//eslint-disable-next-line @typescript-eslint/no-explicit-any
function findTags(obj: any, tagName: string, stats: Stats): void {
  if (Array.isArray(obj)) {
    obj.forEach(item => findTags(item, tagName, stats));
  } else if (typeof obj === "object" && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      if (key === tagName) {
        stats.totalTagsChecked++;
        if (Array.isArray(value)) {
          value.forEach(tagObj => {
            if (typeof tagObj === "object" && tagObj !== null && "$" in tagObj) {
              const terminology = codeSystemMapping[tagObj.$.codeSystem];
              if (!stats.terminologyStats[terminology]) {
                stats.terminologyStats[terminology] = {
                  totalTagsChecked: 0,
                  tagsWithCodeNoDisplayNameThroughout: 0,
                  tagsWithDisplayNameButNoCode: 0,
                };
              }
              stats.terminologyStats[terminology].totalTagsChecked++;

              // Initially assume no displayName is present
              let hasDisplayName = false;
              hasDisplayName =
                hasDisplayName ||
                "originalText" in tagObj ||
                "text" in tagObj ||
                "reference" in tagObj;

              if (tagObj.translation && Array.isArray(tagObj.translation)) {
                hasDisplayName =
                  tagObj.translation.some(
                    (translation: Translation) => !!translation.$.displayName
                  ) || hasDisplayName;
              }

              if (tagObj.translation && Array.isArray(tagObj.translation)) {
                stats.tagsWithTranslation++;
              }

              // Process translations
              if (tagObj.translation && Array.isArray(tagObj.translation)) {
                tagObj.translation.map(
                  (translation: {
                    $: { codeSystem: string; displayName?: string; code?: string };
                  }) => {
                    const translationTerminology = codeSystemMapping[translation.$.codeSystem];
                    if (!stats.terminologyStats[translationTerminology]) {
                      stats.terminologyStats[translationTerminology] = {
                        totalTagsChecked: 0,
                        tagsWithCodeNoDisplayNameThroughout: 0,
                        tagsWithDisplayNameButNoCode: 0,
                      };
                    }
                    stats.terminologyStats[translationTerminology].totalTagsChecked++;

                    const translationHasDisplayName = !!translation.$.displayName;
                    const translationHasCode = !!translation.$.code;

                    if (translationHasDisplayName && !translationHasCode) {
                      stats.terminologyStats[translationTerminology].tagsWithDisplayNameButNoCode++;
                      stats.tagsWithDisplayNameButNoCode++;
                    }

                    if (!hasDisplayName && translationHasCode) {
                      stats.terminologyStats[terminology].tagsWithCodeNoDisplayNameThroughout++;
                      const code = translation.$.code;
                      if (code) {
                        if (!stats.codeOccurrences[code]) {
                          stats.codeOccurrences[code] = 0;
                        }
                        stats.codeOccurrences[code]++;
                      }
                    }
                  }
                );
              }

              const hasCode = !!tagObj.$.code;
              if (!hasCode && hasDisplayName) {
                stats.terminologyStats[terminology].tagsWithDisplayNameButNoCode++;
                stats.tagsWithDisplayNameButNoCode++;
              }

              // process main tag
              if (!hasDisplayName && hasCode) {
                stats.tagsWithCodeNoDisplayNameThroughout++;
                stats.terminologyStats[terminology].tagsWithCodeNoDisplayNameThroughout++;
                const code = tagObj.$.code;
                if (!stats.codeOccurrences[code]) {
                  stats.codeOccurrences[code] = 0;
                }
                stats.codeOccurrences[code]++;
              }
            }
          });
        }
      } else {
        findTags(value, tagName, stats);
      }
    });
  }
}

function countXmlFiles(dirPath: string): number {
  let count = 0;
  const filesAndDirs = fs.readdirSync(dirPath);

  filesAndDirs.forEach(fileOrDir => {
    const fullPath = path.join(dirPath, fileOrDir);
    if (fs.statSync(fullPath).isDirectory()) {
      count += countXmlFiles(fullPath); // Recursively count in subdirectories
    } else if (path.extname(fileOrDir).toLowerCase() === ".xml") {
      count++;
    }
  });

  return count;
}

async function parseDirectory(dirPath: string, stats: Stats): Promise<void> {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await parseDirectory(fullPath, stats); // Recursively process subdirectories
    } else if (path.extname(entry.name).toLowerCase() === ".xml") {
      stats.totalFiles++;
      await checkXmlFile(fullPath, stats);
    }
  }
}

async function main() {
  const dirPath =
    "/Users/jonahkaye/Desktop/2024-01-23T08:02:29.892Z/circle-medical-100-adhd-patient-sample";
  const xmlFileCount = countXmlFiles(dirPath);
  console.log(`Total XML files found: ${xmlFileCount}`);
  try {
    const stats: Stats = {
      codeOccurrences: {},
      totalFiles: 0,
      tagsWithTranslation: 0,
      tagsWithDisplayNameButNoCode: 0,
      tagsWithCodeNoDisplayNameThroughout: 0,
      totalTagsChecked: 0,
      terminologyStats: {},
    };

    await parseDirectory(dirPath, stats);
    const sortedCodes = Object.entries(stats.codeOccurrences).sort((a, b) => b[1] - a[1]);

    console.log("Most common codes:", JSON.stringify(sortedCodes, null, 2));
  } catch (error) {
    console.error(error);
  }
}

main();
