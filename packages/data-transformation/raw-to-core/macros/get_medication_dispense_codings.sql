-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_dispense_category_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select
                id as medication_dispense_id
            ,   category_coding_{{i}}_code as code
            ,   case 
                    when category_coding_{{i}}_system ilike '%medicationdispense-category' then 'http://terminology.hl7.org/fhir/CodeSystem/medicationdispense-category'
                end as system
            ,   category_coding_{{i}}_display as display
            ,   {{i}} as index
        from {{ref('stage__medicationdispense')}}
        where  category_coding_{{i}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
-- TODO Eng-1029 -- TOTALLY UNSED
{% macro get_medication_dispense_type_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select
                id as medication_dispense_id
            ,   type_coding_{{i}}_code as code
            ,   case 
                    when type_coding_{{i}}_system ilike '%v3-ActCode%' then 'http://terminology.hl7.org/CodeSystem/v3-ActCode'
                    else type_coding_{{i}}_system 
                end as system
            ,   type_coding_{{i}}_display as display
            ,   {{i}} as index
        from {{ref('stage__medicationdispense')}}
        where  type_coding_{{i}}_code != ''
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
