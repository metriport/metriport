-- SELECT statement for condition_code_coding
SELECT 
    code,
    condition_id,
    display,
    system,
    filename,
    processed_date
FROM {{ source("raw", "condition_code_coding") }}
