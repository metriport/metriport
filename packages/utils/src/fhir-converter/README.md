# Testing Flow

Each of these is used by passing in the file you want to compare, so:

`./scripts/compare_total_resource_counts.sh "$FILE_LOCATION"`

- `compare_resource_counts_per_file.sh`
- `compare_total_resource_count_post_hapi.sh`
- `compare_total_resource_counts.sh`

You can use `npm run e2e-test-and-compare-total-resource-counts` to get the comparison of the total resource counts for a given e2e test run. If you see unexpected output in the diffs between your changes and the reference counts, then you should look in the runs/$YOUR_RUN and run `./compare_total_resource_counts.sh <your_path>-total-resource-counts.json` to see the per file diff. Then pick a file with an unexpected diff, and start debugging from there.

Run the scripts manually for per file counts and post hapi counts, since the per file counts diff is potentially huge and should be directed to an output file, and inserting into hapi takes a very long time.

# Updating Baseline Files for Resource Count Comparisons

When you're ready to merge your data mapping related changes into the `develop` branch, it's important to update the baseline files with the outputs of your test runs by copying and pasting your output in. This ensures that future comparisons are made against the most current data. The scripts provided in this utils/scripts package are designed to compare your test run outputs against these baseline files.
