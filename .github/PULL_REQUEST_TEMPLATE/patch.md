Issues:

- https://linear.app/metriport/issue/ENG-xxx
- https://linear.app/metriport/issue/ENG-xxx

### Dependencies

- Upstream: _[this PR points to another PR or depends on its release]_
- Downstream: _[PRs that depend on this one, either point to this or can only be released after this one is released]_

### Description

- ...
- ...

### Testing

- [ ] ...WIP
- :warning: [ ] Run E2E tests locally

### Release Plan

_[How does the changes on this PR impact/interact with the existing environment (database, configs, secrets, FFs, api contracts, etc.)?
Consider creating 2+ PRs if we need to ship those changes in a staged way]_

_[This is the release plan for production]_

_[You should execute the exact same steps when releasing to staging to validate it works]_

_[Add and remove items below accordingly]_

- :warning: Points to `master`
- :warning: This contains a DB migration
- [ ] Maintenance window scheduled/created at Checkly (if needed)
- [ ] Execute this on <env1>, <env2>
  - [ ] _step1_
  - [ ] _step2_
- [ ] Added to [monthly product update](https://www.notion.so/metriport/Customer-Updates-21b4e9d3ad5f4fd68db587a11db28cff?pvs=4) (deprecates a feature that needs to be communicated with customers)
- [ ] Added to [monthly product update](https://www.notion.so/metriport/Customer-Updates-21b4e9d3ad5f4fd68db587a11db28cff?pvs=4) (introduce a feature that would be useful customers)
- [ ] Upstream dependencies are met/released
- [ ] Release NPM packages
- [ ] Fern Definition Updated
- [ ] Release Fern SDKs
- [ ] FFs have been set in Staging, Production, and Sandbox
- [ ] Happy-path E2E test created checking new FF flow
- [ ] No dependencies between API and Infra that will cause errors during deployment
- [ ] _[action n-1]_
- [ ] _[action n]_
- [ ] Merge this
