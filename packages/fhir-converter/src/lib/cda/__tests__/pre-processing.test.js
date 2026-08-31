const cda = require('../cda');

describe("preProcessData", function () {
  it("returns the same data if no ampersands present", function (done) {
    const cdaInstance = new cda();
    const data = '<XML data>';
    const processedData = cdaInstance.preProcessData(data);
    expect(processedData).toEqual(data);
    done();
  });

  it("replaces unescaped ampersands with &amp;", function (done) {
    const cdaInstance = new cda();
    const data = 'This & that';
    const expected = 'This &amp; that';
    const processedData = cdaInstance.preProcessData(data);
    expect(processedData).toEqual(expected);
    done();
  });

  it("does not replace already escaped ampersands", function (done) {
    const cdaInstance = new cda();
    const data = 'This &amp; that';
    const processedData = cdaInstance.preProcessData(data);
    expect(processedData).toEqual(data);
    done();
  });

  it("does not replace numeric character references", function (done) {
    const cdaInstance = new cda();
    const data = 'This &#38; that';
    const processedData = cdaInstance.preProcessData(data);
    expect(processedData).toEqual(data);
    done();
  });

  it("does not replace hexadecimal character references", function (done) {
    const cdaInstance = new cda();
    const data = 'This &#x26; that';
    const processedData = cdaInstance.preProcessData(data);
    expect(processedData).toEqual(data);
    done();
  });

  it("does not replace other named character references", function (done) {
    const cdaInstance = new cda();
    const data = 'This &lt; that &gt; this &quot; that &apos;';
    const processedData = cdaInstance.preProcessData(data);
    expect(processedData).toEqual(data);
    done();
  });
});

describe("parseSrcData with large inline base64 payloads", function () {
  it("processes documents with large base64 payloads rapidly without hanging", async function () {
    const cdaInstance = new cda();
    const dummyB64 = Buffer.from("DUMMY_PDF_CONTENT_".repeat(15000)).toString("base64"); // ~350 KB
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <component>
    <structuredBody>
      <component>
        <section>
          <code code="47519-4"/>
          <title>Clinical Notes &amp; PDF Report</title>
          <text mediaType="application/pdf" representation="B64">${dummyB64}</text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;

    const t0 = Date.now();
    const result = await cdaInstance.parseSrcData(xml);
    const duration = Date.now() - t0;

    // Should complete in well under 1 second (typically <50ms)
    expect(duration).toBeLessThan(1000);
    expect(result).toBeDefined();

    const textNode = result.ClinicalDocument.component.structuredBody.component.section.text;
    expect(textNode).toBeDefined();
    expect(textNode._b64).toEqual(dummyB64);
  });

  it("processes multiple base64 and value elements properly", async function () {
    const cdaInstance = new cda();
    const b64A = Buffer.from("SECTION_A_PAYLOAD_".repeat(2000)).toString("base64");
    const b64B = Buffer.from("SECTION_B_PAYLOAD_".repeat(2000)).toString("base64");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <component>
    <structuredBody>
      <component>
        <section>
          <text mediaType="application/pdf" representation="B64">${b64A}</text>
        </section>
      </component>
      <component>
        <section>
          <text mediaType="application/pdf" representation="b64">${b64B}</text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;

    const result = await cdaInstance.parseSrcData(xml);
    expect(result).toBeDefined();
    const sections = result.ClinicalDocument.component.structuredBody.component;
    expect(sections[0].section.text._b64).toEqual(b64A);
    expect(sections[1].section.text._b64).toEqual(b64B);
  });
});