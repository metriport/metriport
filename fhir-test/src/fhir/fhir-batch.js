// Based on: https://github.com/artilleryio/artillery/issues/791#issuecomment-578592350
const fs = require("fs");
const { faker } = require("@faker-js/faker");

const path = `${__dirname}/batch`;

/**
 * Generates post body
 */
const generatePostBody = async (userContext, events, done) => {
  try {
    const files = fs.readdirSync(path);
    const chosenFile = faker.helpers.arrayElement(files);
    // add variables to virtual user's context:
    const fileContents = fs.readFileSync(path + "/" + chosenFile, "utf8");
    userContext.vars.requestBody = JSON.parse(fileContents);
    userContext.vars.requestFile = chosenFile;
    // continue with executing the scenario:
    return done();
  } catch (err) {
    console.log(`Error occurred in function generatePostBody. Detail: ${err}`);
    throw err;
  }
};

module.exports.generatePostBody = generatePostBody;
