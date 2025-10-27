{% macro get_immunization_vaccine_codings(systems, max_index) %}
    {% for i in range(max_index + 1) %}
    select *
    from (
        select 
                id as immunization_id
            ,   vaccinecode_coding_{{i}}_code as code
            ,   case 
                    when vaccinecode_coding_{{i}}_system ilike '%cvx%' then 'http://hl7.org/fhir/sid/cvx'
                    else vaccinecode_coding_{{i}}_system 
                end as system
            ,   vaccinecode_coding_{{i}}_display as display
            ,   {{i}} as coding_index
        from {{ref('stage__immunization')}}
        where  vaccinecode_coding_{{i}}_code != '' and vaccinecode_coding_{{i}}_code is not null
    ) as t
    where t.system in {{ generate_tuple_from_list(systems) }}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
