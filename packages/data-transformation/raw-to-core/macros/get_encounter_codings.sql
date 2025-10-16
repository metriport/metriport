{% macro get_encounter_type_codings(stage_table, max_index, max_second_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(max_second_index + 1) %}
    select 
            id as encounter_id
        ,   type_{{i}}_coding_{{j}}_code as code
        ,   case 
                when type_{{i}}_coding_{{j}}_system ilike '%encounter-type' then 'http://terminology.hl7.org/CodeSystem/encounter-type'
                else type_{{i}}_coding_{{j}}_system 
            end as system
        ,   type_{{i}}_coding_{{j}}_display as display
    from {{ref(stage_table)}}
    where  type_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_encounter_discharge_disposition_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as encounter_id
        ,   hospitalization_dischargedisposition_coding_{{i}}_code as code
        ,   case 
                when hospitalization_dischargedisposition_coding_{{i}}_system ilike '%discharge-disposition' then 'http://terminology.hl7.org/CodeSystem/discharge-disposition'
                else hospitalization_dischargedisposition_coding_{{i}}_system 
            end as system
        ,   hospitalization_dischargedisposition_coding_{{i}}_display as display
    from {{ref(stage_table)}}
    where  hospitalization_dischargedisposition_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
