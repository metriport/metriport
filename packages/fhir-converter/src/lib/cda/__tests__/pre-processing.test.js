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