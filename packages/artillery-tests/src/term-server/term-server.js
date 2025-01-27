const { faker } = require("@faker-js/faker");

const generateParameters = (userContext, events, done) => {
  const count = faker.number.int({ min: 1, max: 250 });
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

  // console.log(params.length);
  userContext.vars.params = params;
  return done();
};

module.exports = {
  generateParameters,
};
