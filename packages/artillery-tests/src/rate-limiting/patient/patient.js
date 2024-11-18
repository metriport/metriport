const { faker } = require("@faker-js/faker");
const dayjs = require("dayjs");

const ISO_DATE = "YYYY-MM-DD";

const generatePatientDemographics = (userContext, events, done) => {
  userContext.vars.firstName = faker.person.firstName();
  userContext.vars.lastName = faker.person.lastName();
  userContext.vars.dob = dayjs(faker.date.past()).format(ISO_DATE);
  userContext.vars.genderAtBirth = faker.helpers.arrayElement(["F", "M"]);
  userContext.vars.addressLine1 = faker.location.streetAddress();
  userContext.vars.city = faker.location.city();
  userContext.vars.zip = faker.location.zipCode().slice(0, 5);
  userContext.vars.state = "CA";
  userContext.vars.country = "USA";
  return done();
};

module.exports = {
  generatePatientDemographics,
};
