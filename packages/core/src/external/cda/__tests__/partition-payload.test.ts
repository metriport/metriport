import { toArray } from "@metriport/shared";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { XMLBuilder } from "fast-xml-parser";
import { readFileSync } from "fs";
import { join } from "path";
import { sizeInBytes } from "../../../util/string";
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

  it("should return single chunk when XML has only one section smaller than max", () => {
    const originalJson = parser.parse(exampleXml);
    const components = toArray(originalJson.ClinicalDocument?.component?.structuredBody?.component);
    const tinySection = components[0];

    const singleSectionJson = {
      ...originalJson,
      ClinicalDocument: {
        ...originalJson.ClinicalDocument,
        component: {
          ...originalJson.ClinicalDocument.component,
          structuredBody: {
            ...originalJson.ClinicalDocument.component.structuredBody,
            component: tinySection,
          },
        },
      },
    };

    const builder = new XMLBuilder({
      format: false,
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      suppressEmptyNode: true,
      suppressBooleanAttributes: false,
    });
    const singleSectionXml = builder.build(singleSectionJson);

    const chunks = partitionPayload(singleSectionXml, MOCK_MAX_CHUNK_SIZE);
    expect(chunks).toBeDefined();
    expect(chunks.length).toBe(1);
    expect(sizeInBytes(JSON.stringify(chunks))).toBeLessThan(MOCK_MAX_CHUNK_SIZE);
  });

  it("should return single chunk when XML has only one section greater than max", () => {
    const originalJson = parser.parse(exampleXml);
    const components = toArray(originalJson.ClinicalDocument?.component?.structuredBody?.component);
    const oversizeSection = components[5];

    const singleSectionJson = {
      ...originalJson,
      ClinicalDocument: {
        ...originalJson.ClinicalDocument,
        component: {
          ...originalJson.ClinicalDocument.component,
          structuredBody: {
            ...originalJson.ClinicalDocument.component.structuredBody,
            component: oversizeSection,
          },
        },
      },
    };

    const builder = new XMLBuilder({
      format: false,
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      suppressEmptyNode: true,
      suppressBooleanAttributes: false,
    });
    const singleSectionXml = builder.build(singleSectionJson);

    const chunks = partitionPayload(singleSectionXml, MOCK_MAX_CHUNK_SIZE);
    expect(chunks).toBeDefined();
    expect(chunks.length).toBe(1);
    expect(sizeInBytes(JSON.stringify(chunks))).toBeGreaterThan(MOCK_MAX_CHUNK_SIZE);
  });

  it("should partition three small sections together into one chunk", () => {
    const originalJson = parser.parse(exampleXml);
    const components = toArray(originalJson.ClinicalDocument?.component?.structuredBody?.component);

    const threeSectionJson = {
      ...originalJson,
      ClinicalDocument: {
        ...originalJson.ClinicalDocument,
        component: {
          ...originalJson.ClinicalDocument.component,
          structuredBody: {
            ...originalJson.ClinicalDocument.component.structuredBody,
            component: components.slice(0, 3),
          },
        },
      },
    };

    const builder = new XMLBuilder({
      format: false,
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      suppressEmptyNode: true,
      suppressBooleanAttributes: false,
    });
    const threeSectionXml = builder.build(threeSectionJson);

    const chunks = partitionPayload(threeSectionXml, MOCK_MAX_CHUNK_SIZE);
    expect(chunks).toBeDefined();
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toEqual(1);
    expect(sizeInBytes(JSON.stringify(chunks))).toBeLessThan(MOCK_MAX_CHUNK_SIZE);
  });

  it("should partition two small sections and one oversize section together and create two chunks", () => {
    const originalJson = parser.parse(exampleXml);
    const components = toArray(originalJson.ClinicalDocument?.component?.structuredBody?.component);

    const smallSections = components.slice(1, 3);
    const mediumSection = components[3];

    const threeSectionJson = {
      ...originalJson,
      ClinicalDocument: {
        ...originalJson.ClinicalDocument,
        component: {
          ...originalJson.ClinicalDocument.component,
          structuredBody: {
            ...originalJson.ClinicalDocument.component.structuredBody,
            component: [...smallSections, mediumSection],
          },
        },
      },
    };

    const builder = new XMLBuilder({
      format: false,
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      suppressEmptyNode: true,
      suppressBooleanAttributes: false,
    });
    const threeSectionXml = builder.build(threeSectionJson);

    const chunks = partitionPayload(threeSectionXml, MOCK_MAX_CHUNK_SIZE);
    expect(chunks).toBeDefined();
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toEqual(2);
    expect(sizeInBytes(JSON.stringify(chunks))).toBeGreaterThan(MOCK_MAX_CHUNK_SIZE);
  });

  it("should partition two small sections and one medium sized section together and create two chunks", () => {
    const originalJson = parser.parse(exampleXml);
    const components = toArray(originalJson.ClinicalDocument?.component?.structuredBody?.component);
    const smallSections = components.slice(0, 2);
    const oversizeSection = components[5];

    const threeSectionJson = {
      ...originalJson,
      ClinicalDocument: {
        ...originalJson.ClinicalDocument,
        component: {
          ...originalJson.ClinicalDocument.component,
          structuredBody: {
            ...originalJson.ClinicalDocument.component.structuredBody,
            component: [...smallSections, oversizeSection],
          },
        },
      },
    };

    const builder = new XMLBuilder({
      format: false,
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      suppressEmptyNode: true,
      suppressBooleanAttributes: false,
    });
    const threeSectionXml = builder.build(threeSectionJson);

    const chunks = partitionPayload(threeSectionXml, MOCK_MAX_CHUNK_SIZE);
    expect(chunks).toBeDefined();
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toEqual(2);
    expect(sizeInBytes(JSON.stringify(chunks[0]))).toBeLessThan(MOCK_MAX_CHUNK_SIZE);
    expect(sizeInBytes(JSON.stringify(chunks[1]))).toBeGreaterThan(MOCK_MAX_CHUNK_SIZE);
  });

  it("should partition three sections with the second one being larger than max size, and create three chunks", () => {
    const originalJson = parser.parse(exampleXml);
    const components = toArray(originalJson.ClinicalDocument?.component?.structuredBody?.component);
    const smallSectionOne = components[1];
    const smallSectionTwo = components[2];
    const oversizeSection = components[5];

    const threeSectionJson = {
      ...originalJson,
      ClinicalDocument: {
        ...originalJson.ClinicalDocument,
        component: {
          ...originalJson.ClinicalDocument.component,
          structuredBody: {
            ...originalJson.ClinicalDocument.component.structuredBody,
            component: [smallSectionOne, oversizeSection, smallSectionTwo],
          },
        },
      },
    };

    const builder = new XMLBuilder({
      format: false,
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      suppressEmptyNode: true,
      suppressBooleanAttributes: false,
    });
    const threeSectionXml = builder.build(threeSectionJson);

    const chunks = partitionPayload(threeSectionXml, MOCK_MAX_CHUNK_SIZE);
    expect(chunks).toBeDefined();
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toEqual(3);
    expect(sizeInBytes(JSON.stringify(chunks[0]))).toBeLessThan(MOCK_MAX_CHUNK_SIZE);
    expect(sizeInBytes(JSON.stringify(chunks[1]))).toBeGreaterThan(MOCK_MAX_CHUNK_SIZE);
    expect(sizeInBytes(JSON.stringify(chunks[2]))).toBeLessThan(MOCK_MAX_CHUNK_SIZE);
  });

  it("should partition large XML document into multiple chunks and the number of sections is preserved", () => {
    const chunks = partitionPayload(exampleXml, MOCK_MAX_CHUNK_SIZE);
    expect(chunks).toBeDefined();
    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toEqual(5);

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
});
