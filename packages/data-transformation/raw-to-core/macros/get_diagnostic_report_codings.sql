{% macro get_diagnostic_report_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as diagnostic_report_id
        ,   code_coding_{{i}}_code as code
        ,   case 
                when code_coding_{{i}}_system ilike '%loinc%' then 'http://loinc.org'
                else code_coding_{{i}}_system 
            end as system
        ,   code_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  code_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}


{% macro get_diagnostic_report_category_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select 
            id as diagnostic_report_id
        ,   category_{{i}}_coding_{{j}}_code as code
        ,   case 
                when category_{{i}}_coding_{{j}}_system = '%v2-0074' then 'http://terminology.hl7.org/CodeSystem/v2-0074'
            end as system
        ,   category_{{i}}_coding_{{j}}_display as display
    from {{ref(stage_table)}}
    where  category_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
