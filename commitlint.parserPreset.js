const teams = ["ENG", "OPS", "CS", "MKT", "SLS"];

const prefixes = ["Ref", "References", "Part of", "Fixes", "Closes"];

const issuePrefixes = [
  " #", // TODO REMOVE THIS ASAP, this is a temporary fix to allow commitlint to work with existing commits that reference GH issues
  ...prefixes.flatMap(prefix => {
    return teams.map(team => `${prefix} ${team}-`);
  }),
];

module.exports = {
  parserOpts: {
    issuePrefixes,
  },
};