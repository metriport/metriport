{% macro encounter_type_code_system() %}
    case 
        when system = 'act' then 0
        when system = 'cpt' then 1
        else 2
    end
{% endmacro %}

{% macro get_encounter_type_codings(stage_table, max_index, max_second_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(max_second_index + 1) %}
    select 
            id as encounter_id
        ,   type_{{i}}_coding_{{j}}_code as code
        ,   case 
                when type_{{i}}_coding_{{j}}_system ilike '%v3-ActCode%' then 'act'
                when type_{{i}}_coding_{{j}}_system ilike '%cpt%' then 'cpt'
                else type_{{i}}_coding_{{j}}_system 
            end as system
        ,   type_{{i}}_coding_{{j}}_display as display
        ,   coalesce(
                type_{{i}}_coding_{{j}}_display,
                type_{{i}}_text
            ) as description
    from {{ref(stage_table)}}
    where  type_{{i}}_coding_{{j}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
-- TODO Eng-1029 -- ONLY DESCRIPTION IS USED
{% macro encounter_discharge_disposition_code_system() %}
    case 
        when 1 = 1 then 0
    end
{% endmacro %}
-- TODO Eng-1029 -- ONLY DESCRIPTION IS USED
{% macro get_encounter_discharge_disposition_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as encounter_id
        ,   hospitalization_dischargedisposition_coding_{{i}}_code as code
        ,   case 
                when hospitalization_dischargedisposition_coding_{{i}}_system ilike '%v3-ActCode%' then 'act'
                when hospitalization_dischargedisposition_coding_{{i}}_system ilike '%cpt%' then 'cpt'
                else hospitalization_dischargedisposition_coding_{{i}}_system 
            end as system
        ,   hospitalization_dischargedisposition_coding_{{i}}_display as display
        ,   coalesce(
                hospitalization_dischargedisposition_coding_{{i}}_display,
                hospitalization_dischargedisposition_text
            ) as description
    from {{ref(stage_table)}}
    where  hospitalization_dischargedisposition_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
-- TODO Eng-1029 -- ONLY DESCRIPTION IS USED
{% macro encounter_priority_code_system() %}
    case 
        when 1 = 1 then 0
    end
{% endmacro %}
-- TODO Eng-1029 -- ONLY DESCRIPTION IS USED
{% macro get_encounter_priority_codings(stage_table, max_index) %}
    {% for i in range(max_index + 1) %}
    select 
            id as encounter_id
        ,   priority_coding_{{i}}_code as code
        ,   case 
                when priority_coding_{{i}}_system ilike '%v3-ActCode%' then 'act'
                when priority_coding_{{i}}_system ilike '%cpt%' then 'cpt'
                else priority_coding_{{i}}_system 
            end as system
        ,   priority_coding_{{i}}_display as display
        ,   coalesce(
                priority_coding_{{i}}_display,
                priority_text
            ) as description
    from {{ref(stage_table)}}
    where  priority_coding_{{i}}_code != ''
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}