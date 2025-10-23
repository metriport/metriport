{% macro get_encounter_type_codings(systems, max_index, max_second_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(max_second_index + 1) %}
    select *
    from (
        select 
                id as encounter_id
            ,   type_{{i}}_coding_{{j}}_code as code
            ,   case 
                    when type_{{i}}_coding_{{j}}_system ilike '%encounter-type' then 'http://terminology.hl7.org/CodeSystem/encounter-type'
                    else type_{{i}}_coding_{{j}}_system 
                end as system
            ,   type_{{i}}_coding_{{j}}_display as display
            ,   {{i}} * ({{ max_second_index }} + 1) + {{j}} as coding_index
        from {{ref('stage__encounter')}}
        where  type_{{i}}_coding_{{j}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_encounter_discharge_disposition_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select 
                id as encounter_id
            ,   hospitalization_dischargedisposition_coding_{{i}}_code as code
            ,   case 
                    when hospitalization_dischargedisposition_coding_{{i}}_system ilike '%discharge-disposition' then 'http://terminology.hl7.org/CodeSystem/discharge-disposition'
                    else hospitalization_dischargedisposition_coding_{{i}}_system 
                end as system
            ,   hospitalization_dischargedisposition_coding_{{i}}_display as display
            ,   {{i}} as coding_index
        from {{ref('stage__encounter')}}
        where  hospitalization_dischargedisposition_coding_{{i}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}

{% macro get_encounter_reason_codings(systems, max_index, max_second_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(max_second_index + 1) %}
    select *
    from (
        select 
                id as encounter_id
            ,   reasoncode_{{i}}_coding_{{j}}_code as code
            ,   case 
                    when reasoncode_{{i}}_coding_{{j}}_system ilike '%snomed%' then 'http://snomed.info/sct'
                    else reasoncode_{{i}}_coding_{{j}}_system 
                end as system
            ,   reasoncode_{{i}}_coding_{{j}}_display as display
            ,   {{i}} * ({{ max_second_index }} + 1) + {{j}} as coding_index
        from {{ref('stage__encounter')}}
        where  reasoncode_{{i}}_coding_{{j}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
