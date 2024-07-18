The tests are using pre-generated JSON FHIR Bundles, and check the results against the pre-generated XMLs.
The XMLs have placeholder variables that get replaced with actual values using the `eval()` function.
However, this function does not explicitly indicate it's using the constants. Therefore, we end up in a scenario where the constants are marked as `unused`. As a workaround, we're using these constants in `console.log()`.
