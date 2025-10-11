### Dependencies

- Upstream: _[this PR points to another PR or depends on its release]_
- Downstream: _[PRs that depend on this one, either point to this or can only be released after this one is released]_

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

### Metrics

_[Plan ahead how we are going to monitor your changes. If a metric is not applicable, explain why.]_

- [ ] Alarms _[Alarms trigger PagerDuty. These should only happen when there's a significant issue with the platform - they require immediate action. This is the most important metric, but also let's be careful if it's really immediate action or just asap (alert).]_

- [ ] Alerts _[Alerts just go into a Slack channel - not as urgent as alarms, but still let on-call know something needs attention.]_

- [ ] Cloudwatch metrics _[Engineering geared metrics, things that need lower latency and smaller granularity, that software engineers will use for monitoring, diagnosing issues, making decisions about the platform]_

- [ ] Posthog metrics _[Product-related metrics, geared towards Ops and Customer success teams; e.g., number of patients created, lead time to get data from the platform, etc.]_

### Release Plan

_[How does the changes on this PR impact/interact with the existing environment (database, configs, secrets, FFs, api contracts, etc.)?
Consider creating 2+ PRs if we need to ship those changes in a staged way]_

_[This is the release plan for production]_

_[You should execute the exact same steps when releasing to staging to validate it works]_

_[Add and remove items below accordingly]_

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
- [ ] FHIR Integration Test ran with validation
- [ ] _[action n-1]_
- [ ] _[action n]_
- [ ] Merge this
