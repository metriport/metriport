-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_statement_category_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as medication_statement_id
        ,   category_coding_{{i}}_code as code
        ,   case 
                when category_coding_{{i}}_system ilike '%medication-statement-category' then 'http://terminology.hl7.org/CodeSystem/medication-statement-category'
            end as system
        ,   category_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  category_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
