/*global module*/
module.exports = {
    // Resolve and load @commitlint/config-conventional from node_modules. Referenced packages must be installed
    extends: ["@commitlint/config-conventional"],
    // Any rules defined here will override rules from @commitlint/config-conventional
    rules: {
        "footer-empty": [2, "never"],
    },
    ignores: [(message) => /^Bumps \[.+]\(.+\) from .+ to .+\.$/m.test(message)],
};
