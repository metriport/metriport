const { faker } = require("@faker-js/faker");

const bundleTemplate = {
  resourceType: "Bundle",
  type: "collection",
  entry: [],
};

const sameIdentifier = faker.string.uuid();
const idToKeep = faker.string.uuid();

const encompassingEncounter = {
  resource: {
    resourceType: "Encounter",
    id: faker.string.uuid(),
    status: "unknown",
    identifier: [
      {
        system: "http://example.com",
        value: sameIdentifier,
      },
    ],
    serviceProvider: {
      reference: "Organization/bcde5678",
    },
  },
};

const internalEncounter = {
  resource: {
    resourceType: "Encounter",
    id: idToKeep,
    status: "active",
    identifier: [
      {
        system: "http://example.com",
        value: sameIdentifier,
      },
    ],
    subject: {
      reference: "Patient/abcd1234",
    },
  },
};

const mergedEncounter = {
  resource: {
    resourceType: "Encounter",
    id: idToKeep,
    status: "active",
    identifier: [
      {
        system: "http://example.com",
        value: sameIdentifier,
      },
    ],
    subject: {
      reference: "Patient/abcd1234",
    },
    serviceProvider: {
      reference: "Organization/bcde5678",
    },
  },
};

module.exports = {
  bundleTemplate,
  encompassingEncounter,
  internalEncounter,
  mergedEncounter,
};
