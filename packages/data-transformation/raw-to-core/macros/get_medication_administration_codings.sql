-- TODO Eng-1029 -- TOTALLY UNSED
{% macro medication_administration_category_code_system() %}
    case 
        when 1 = 1 then 0
    end
{% endmacro %}
-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_administration_category_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as medication_administration_id
        ,   category_coding_{{i}}_code as code
        ,   case 
                when 1 = 1 then category_coding_{{i}}_system 
            end as system
        ,   category_coding_{{i}}_display as display
        ,   coalesce(
                category_coding_{{i}}_display,
                category_text
            ) as description
    from {{ref(stage_table)}}
    where  category_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
-- TODO Eng-1029 -- TOTALLY UNSED
{% macro medication_administration_reason_code_system() %}
    case 
        when 1 = 1 then 0
    end
{% endmacro %}
-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_administration_reason_codings(stage_table, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select
            id as medication_administration_id
        ,   reasoncode_{{i}}_coding_{{j}}_code as code
        ,   case 
                when 1 = 1 then reasoncode_{{i}}_coding_{{j}}_system 
            end as system
        ,   reasoncode_{{i}}_coding_{{j}}_display as display
        ,   coalesce(
                reasoncode_{{i}}_coding_{{j}}_display,
                reasoncode_{{i}}_text
            ) as description
    from {{ref(stage_table)}}
    where  reasoncode_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}