{% macro immunization_vaccine_code_system() %}
    case 
        when system = 'cvx' then 0
        else 1
    end
{% endmacro %}

{% macro get_immunization_vaccine_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as immunization_id
        ,   vaccinecode_coding_{{i}}_code as code
        ,   case 
                when vaccinecode_coding_{{i}}_system ilike '%cvx%' then 'cvx'
                else vaccinecode_coding_{{i}}_system 
            end as system
        ,   vaccinecode_coding_{{i}}_display as display
        ,   coalesce(
                vaccinecode_coding_{{i}}_display,
                vaccinecode_text
            ) as description
    from {{ref(stage_table)}}
    where  vaccinecode_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}