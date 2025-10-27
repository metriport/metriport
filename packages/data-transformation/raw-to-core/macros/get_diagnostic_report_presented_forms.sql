{% macro get_diagnostic_report_presented_forms(max_index) %}
    {% for i in range(max_index + 1) %}
    {% set formatted_index = i|string %}
    {% if max_index > 9 %}
        {% set formatted_index = "%02d"|format(i) %}
    {% endif %}
    select
            id                                         as diagnostic_report_id
        ,   presentedform_{{formatted_index}}_data                   as data
        ,   presentedform_{{formatted_index}}_contenttype            as content_type
        ,   presentedform_{{formatted_index}}_creation               as creation
        ,   presentedform_{{formatted_index}}_hash                   as hash
        ,   presentedform_{{formatted_index}}_language               as language
        ,   presentedform_{{formatted_index}}_size                   as size
        ,   presentedform_{{formatted_index}}_title                  as title
        ,   presentedform_{{formatted_index}}_url                    as url
    from {{ref('stage__diagnosticreport')}}
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
{% endmacro %}
