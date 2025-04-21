/*global module*/
module.exports = {
  // Resolve and load @commitlint/config-conventional from node_modules. Referenced packages must be installed
  extends: ["@commitlint/config-conventional"],
  // Any rules defined here will override rules from @commitlint/config-conventional
  rules: {
    "footer-empty": [2, "never"],
    "footer-leading-blank": [2, "always"],
    "references-empty": [2, "never"],
  },
  parserPreset: {
    parserOpts: {
      issuePrefixes: [
        " #", // TODO REMOVE THIS ASAP, this is a temporary fix to allow commitlint to work with existing commits that reference GH issues
        "Ref ENG-",
        "References ENG-",
        "Part of ENG-",
        "Fixes ENG-",
        "Closes ENG-",
        "Ref CS-",
        "References CS-",
        "Part of CS-",
        "Fixes CS-",
        "Closes CS-",
      ],
    },
  },
  ignores: [message => /^Bumps \[.+]\(.+\) from .+ to .+\.$/m.test(message)],
};
