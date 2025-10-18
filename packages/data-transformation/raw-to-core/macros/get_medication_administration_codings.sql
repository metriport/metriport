-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_administration_category_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select
                id as medication_administration_id
            ,   category_coding_{{i}}_code as code
            ,   case 
                    when category_coding_{{i}}_system ilike '%medication-admin-category' then 'http://terminology.hl7.org/CodeSystem/medication-admin-category'
                    else category_coding_{{i}}_system 
                end as system
            ,   category_coding_{{i}}_display as display
            ,   {{i}} as index
        from {{ref('stage__medicationadministration')}}
        where  category_coding_{{i}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_administration_reason_codings(systems, max_index, secondary_max_index) %}
    {% for i in range(max_index + 1) %}
    {% for j in range(secondary_max_index + 1) %}
    select *
    from (
        select
                id as medication_administration_id
            ,   reasoncode_{{i}}_coding_{{j}}_code as code
            ,   case 
                    when reasoncode_{{i}}_coding_{{j}}_system ilike '%reason-medication-given' then 'http://terminology.hl7.org/CodeSystem/reason-medication-given'
                    else reasoncode_{{i}}_coding_{{j}}_system 
                end as system
            ,   reasoncode_{{i}}_coding_{{j}}_display as display
            ,   {{i}} * ({{ secondary_max_index }} + 1) + {{j}} as index
        from {{ref('stage__medicationadministration')}}
        where  reasoncode_{{i}}_coding_{{j}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
