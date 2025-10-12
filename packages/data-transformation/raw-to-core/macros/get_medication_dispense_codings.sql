-- TODO Eng-1029 -- TOTALLY UNSED
{% macro medication_dispense_category_code_system() %}
    case 
        when 1 = 1 then 0
    end
{% endmacro %}
-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_dispense_category_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as medication_dispense_id
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
{% macro medication_dispense_type_code_system() %}
    case 
        when 1 = 1 then 0
    end
{% endmacro %}
-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_dispense_type_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id as medication_dispense_id
        ,   type_coding_{{i}}_code as code
        ,   case 
                when 1 = 1 then type_coding_{{i}}_system 
            end as system
        ,   type_coding_{{i}}_display as display
        ,   coalesce(
                type_coding_{{i}}_display,
                type_text
            ) as description
    from {{ref(stage_table)}}
    where  type_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}