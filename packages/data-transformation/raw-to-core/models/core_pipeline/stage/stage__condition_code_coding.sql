SELECT 
    code,
    condition_id,
    display,
    system,
    filename,
    processed_date
FROM {{ source("raw", "condition_code_coding_view" if target.name == "postgres" else "condition_code_coding") }}
