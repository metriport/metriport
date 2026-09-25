const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const helpers = require("../handlebars-helpers").external;

describe("ServiceRequest CDA template", () => {
  it("writes the requested date to the FHIR occurrenceDateTime field", () => {
    const handlebars = Handlebars.create();
    helpers.forEach(helper => handlebars.registerHelper(helper.name, helper.func));
    handlebars.registerPartial("ValueSet/RequestStatus.hbs", '"active"');
    handlebars.registerPartial("DataType/CodeableConcept.hbs", '{"text":"Example"}');
    const templatePath = path.join(
      __dirname,
      "../../../templates/cda/Resources/ServiceRequest.hbs"
    );
    const template = handlebars.compile(fs.readFileSync(templatePath, "utf8"));

    const rendered = template({
      ID: "order-1",
      serviceEntry: {
        id: [],
        statusCode: { code: "active" },
        code: {},
        priorityCode: { displayName: "routine" },
        effectiveTime: { value: "20240101120000" },
      },
    });
    const bundleEntry = JSON.parse(rendered.replace(/,\s*([}\]])/g, "$1").replace(/,\s*$/, ""));

    expect(bundleEntry.resource.occurrenceDateTime).toBe("2024-01-01T12:00:00.000Z");
    expect(bundleEntry.resource).not.toHaveProperty("occuranceDateTime");
  });
});
