### Dependencies

- Upstream:
- Downstream:

### Description

_[Document your changes, give context for reviewers, add images/videos of UI changes]_

### Testing

_[Plan ahead how you're validating your changes work and don't break other features. Add tests to validate the happy
path and the alternative ones. Be specific.]_

- Local
  - [ ] _[Indicate how you tested this, on local or staging]_
  - [ ] ...
- Staging
  - [ ] _testing step 1_
  - [ ] _testing step 2_
- Sandbox
  - [ ] _testing step 1_
  - [ ] _testing step 2_
- Production
  - [ ] _testing step 1_
  - [ ] _testing step 2_

### Release Plan

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
