const { faker } = require("@faker-js/faker");

const generateRandomData = (userContext, events, done) => {
  userContext.vars.id = faker.string.uuid();
  return done();
};

module.exports = {
  generateRandomData,
};
