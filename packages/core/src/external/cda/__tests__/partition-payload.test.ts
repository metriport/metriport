import { readFileSync } from "fs";
import { join } from "path";
import { toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { partitionPayload } from "../partition-payload";

const MOCK_MAX_CHUNK_SIZE = 100_000;

describe("partitionPayload", () => {
  const exampleXmlPath = join(__dirname, "example.xml");
  const exampleXml = readFileSync(exampleXmlPath, "utf-8");
  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    removeNSPrefix: true,
  });

  it("should partition large XML document into multiple chunks and the number of sections is preserved", () => {
    const chunks = partitionPayload(exampleXml, MOCK_MAX_CHUNK_SIZE);
    expect(chunks).toBeDefined();
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toEqual(6);

    chunks.forEach(chunk => {
      expect(typeof chunk).toBe("string");
      expect(chunk).toMatch(/^<\?xml/);
      expect(chunk).toMatch(/<\/ClinicalDocument>$/);
    });

    const originalJson = parser.parse(exampleXml);
    const components = toArray(originalJson.ClinicalDocument?.component?.structuredBody?.component);
    const originalSectionCount = components.length;

    let totalChunkSections = 0;
    chunks.forEach(chunk => {
      const chunkJson = parser.parse(chunk);
      const chunkComponents = toArray(
        chunkJson.ClinicalDocument?.component?.structuredBody?.component
      );
      const chunkSectionCount = chunkComponents.length;
      totalChunkSections += chunkSectionCount;
    });

    expect(totalChunkSections).toBe(originalSectionCount);
  });

  it("should return single chunk if content is smaller than maxChunkSize", () => {
    const smallXml = `<?xml version="1.0" encoding="UTF-8"?>
      <ClinicalDocument>
        <component>
          <structuredBody>
            <component>
              <section>
                <text>Small test</text>
              </section>
            </component>
          </structuredBody>
        </component>
      </ClinicalDocument>`;

    const chunks = partitionPayload(smallXml);
    expect(chunks).toBeDefined();
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(smallXml);
  });
});
