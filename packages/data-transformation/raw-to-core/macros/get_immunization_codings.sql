{% macro get_immunization_vaccine_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as immunization_id
        ,   vaccinecode_coding_{{i}}_code as code
        ,   case 
                when vaccinecode_coding_{{i}}_system ilike '%cvx%' then 'http://hl7.org/fhir/sid/cvx'
                else vaccinecode_coding_{{i}}_system 
            end as system
        ,   vaccinecode_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  vaccinecode_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
