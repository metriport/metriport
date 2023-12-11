Ticket: #_[ticket-number]_

### Dependencies

- Upstream: _[this PR points to another PR or depends on its release]_
- Downstream: _[PRs that depend on this one, either point to this or can only be released after this one is released]_

### Description

_[Document your changes, give context for reviewers, add images/videos of UI changes]_

### Testing

- Local
  - [x] _[Indicate how you tested this, on local or staging]_
  - [x] ...
- Staging
  - [ ] _testing step 1_
  - [ ] _testing step 2_
- Production
  - [ ] _testing step 1_
  - [ ] _testing step 2_

### Release Plan

_[This is the release plan for production]_

_[You should execute the exact same steps when releasing to staging to validate it works]_

_[Add and remove items below accordingly]_

- :warning: Points to `master`
- :warning: This contains a DB migration
- [ ] Execute this on <env1>, <env2>
  - [ ] _step1_
  - [ ] _step2_
- [ ] Added to [monthly product update](https://www.notion.so/metriport/Customer-Updates-21b4e9d3ad5f4fd68db587a11db28cff?pvs=4) (deprecates a feature that needs to be communicated with customers)
- [ ] Added to [monthly product update](https://www.notion.so/metriport/Customer-Updates-21b4e9d3ad5f4fd68db587a11db28cff?pvs=4) (introduce a feature that would be useful customers)
- [ ] Upstream dependencies are met
- [ ] Release NPM packages
- [ ] _[action n-1]_
- [ ] _[action n]_
- [ ] Merge this
