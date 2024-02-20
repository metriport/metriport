# Testing Flow

First install jsondiffpatch with:

`npm install -g jsondiffpatch`

Now, each of these scripts is used by passing in the file you want to compare:

`npm run compare-total-resource-counts "$FILE_LOCATION"`
`npm run compare-resource-counts-per-file "$FILE_LOCATION"`
`npm run compare-total-resource-count-post-fhir-insert "$FILE_LOCATION"`

You can use `npm run e2e-test-and-compare-total-resource-counts` to get the comparison of the total resource counts for a given e2e test run. If you see unexpected output in the diffs between your changes and the reference counts, then you should look in the runs/$YOUR_RUN and run `compare-total-resource-counts` to see the per file diff. Then pick a file with an unexpected diff, and start debugging from there.

Before marking a PR ready for review, you should have diffs that make sense for:

- `compare-total-resource-counts`
- `compare-total-resource-count-post-fhir-insert`

# Updating Baseline Files for Resource Count Comparisons

When you're ready to merge your data mapping related changes into the `develop` branch, it's important to update the baseline files with the outputs of your test runs by copying and pasting your output in. This ensures that future comparisons are made against the most current data. The scripts provided in this utils/scripts package are designed to compare your test run outputs against these baseline files.
