{% macro get_diagnostic_report_presented_forms(max_index) %}
    {% for i in range(max_index + 1) %}
    select
            id                                         as diagnostic_report_id
        ,   presentedform_{{i}}_data                   as data
        ,   presentedform_{{i}}_contenttype            as content_type
        ,   presentedform_{{i}}_creation               as creation
        ,   presentedform_{{i}}_hash                   as hash
        ,   presentedform_{{i}}_language               as language
        ,   presentedform_{{i}}_size                   as size
        ,   presentedform_{{i}}_title                  as title
        ,   presentedform_{{i}}_url                    as url
    from {{ref('stage__diagnosticreport')}}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
