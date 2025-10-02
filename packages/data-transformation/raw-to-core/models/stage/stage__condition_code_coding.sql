
-- SELECT statement for Condition_code_coding
SELECT 
    condition_id,
    system,
    code,
    display,
    filename,
    processed_date 
FROM {{source('raw', 'condition_code_coding_view') }} x
