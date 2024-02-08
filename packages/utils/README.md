# Using the comparison scripts

Each of these is used by passing in the file you want to compare, so:

`./scripts/compare_total_resource_counts.sh "$FILE_LOCATION"`

- `compare_resource_counts_per_file.sh`
- `compare_total_resource_count_post_hapi.sh`
- `compare_total_resource_counts.sh`

You can use `npm run e2e-test-and-compare-total-resource-counts` to get the comparison of the total resource counts for a given e2e test run.

Run the scripts manually for per file counts and post hapi counts, since the per file counts diff is potentially huge and should be directed to an output file, and inserting into hapi takes a very long time.

# Updating S3 Baseline Files for Resource Count Comparisons

When you're ready to merge your data mapping related changes into the `develop` branch, it's important to update the baseline files on S3 with the outputs of your test runs. This ensures that future comparisons are made against the most current data. The scripts provided in this utils/scripts package are designed to compare your test run outputs against these baseline files:

## Instructions for Updating a File on S3

1. **Identify the Correct S3 File to Update**: Each script is associated with a specific file on S3. Determine which file(s) you need to update based on the script(s) you used for comparison:

   - For `compare_resource_counts_per_file.sh`, update `develop-per-file-resource-counts.json`.
   - For `compare_total_resource_count_post_hapi.sh`, update `develop-fhir-resource-count-post-hapi.json`.
   - For `compare_total_resource_counts.sh`, update `develop-fhir-resource-count.json`.

2. **Prepare Your New Baseline File**: Ensure that the output file from your test run is ready and contains the correct data format expected by the comparison scripts.

3. **Upload the New Baseline File to S3**: Use the AWS CLI to upload your new baseline file to the correct S3 bucket and path. Replace `<your_new_baseline_file>` with the path to your new baseline file and `<s3_file_path>` with the correct S3 path from step 1.

`aws s3 cp my-new-resource-counts.json s3://fhir-resource-count/develop-per-file-resource-counts.json`

4. **Verify the Upload**: Ensure that the file has been successfully uploaded to S3 by listing the contents of the directory or directly accessing the file.

`aws s3 ls s3://fhir-resource-count/`

5. **Run a Comparison Test (Optional)**: After updating the baseline file on S3, you may want to run the comparison script again with your test output to ensure that there are no unexpected differences.

By following these steps, you ensure that the baseline files used for comparison are always up to date with the latest test run outputs, maintaining the integrity of the development process.

**Note**: The S3 bucket used for storing the baseline files is versioned. This means that every time you upload a new file, the previous version is not overwritten but kept as an older version.
