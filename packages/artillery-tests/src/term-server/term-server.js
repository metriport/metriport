const { faker } = require("@faker-js/faker");

const DEFAULT_INPUT_PAYLOAD_LARGE_SIZE = 250;
const generateParameters = (userContext, events, done) => {
  const count = userContext.vars.count ?? DEFAULT_INPUT_PAYLOAD_LARGE_SIZE;

  const params = Array.from({ length: count }, () => ({
    resourceType: "Parameters",
    id: faker.string.uuid(),
    parameter: [
      {
        name: "system",
        valueUri: "http://loinc.org",
      },
      {
        name: "code",
        valueCode: `${faker.number.int({ min: 1000, max: 9999 })}-${faker.number.int({
          min: 0,
          max: 4,
        })}`,
      },
    ],
  }));

  userContext.vars.params = params;
  return done();
};

module.exports = {
  generateParameters,
};
