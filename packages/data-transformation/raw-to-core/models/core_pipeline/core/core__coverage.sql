{{ config(unique_key='m_patient_id') }}
{% set extension_max_index = 2 %}

select
      {{ try_to_cast_string('c.id') }}                                              as coverage_id
    , {{ try_to_cast_string('right(c.beneficiary_reference, 36)') }}                as patient_id
    , {{ try_to_cast_string('c.status') }}                                          as status
    , {{ try_to_cast_datetime('c.period_start') }}                                  as period_start
    , {{ try_to_cast_datetime('c.period_end') }}                                    as period_end
    , {{ try_to_cast_string('c.type_coding_0_code') }}                              as type_code
    , {{ try_to_cast_string('c.type_coding_0_display') }}                           as type_display
    , {{ try_to_cast_string('c.type_coding_0_system') }}                            as type_system
    , {{ try_to_cast_string('c.subscriberid') }}                                    as subscriber_member_id
    , {{ try_to_cast_string('c.dependent') }}                                       as dependent
    , {{ try_to_cast_string('c.relationship_coding_0_code') }}                      as relationship_code
    , {{ try_to_cast_string('c.relationship_coding_0_display') }}                   as relationship_display
    , {{ try_to_cast_string('c.relationship_coding_0_system') }}                    as relationship_system
    {#- Group class: Get first matching class by index order (0, 1) -#}
    , {{ try_to_cast_string("case
            when lower(c.class_0_type_coding_0_code) = lower('group') then c.class_0_value
            when lower(c.class_0_type_coding_1_code) = lower('group') then c.class_0_value
            when lower(c.class_1_type_coding_0_code) = lower('group') then c.class_1_value
            when lower(c.class_1_type_coding_1_code) = lower('group') then c.class_1_value
        end") }}                                                                     as class_group_code
    , {{ try_to_cast_string("case
            when lower(c.class_0_type_coding_0_code) = lower('group') then c.class_0_type_coding_0_display
            when lower(c.class_0_type_coding_1_code) = lower('group') then c.class_0_type_coding_1_display
            when lower(c.class_1_type_coding_0_code) = lower('group') then c.class_1_type_coding_0_display
            when lower(c.class_1_type_coding_1_code) = lower('group') then c.class_1_type_coding_1_display
        end") }}                                                                     as class_group_display
    , {{ try_to_cast_string("case
            when lower(c.class_0_type_coding_0_code) = lower('group') then c.class_0_type_coding_0_system
            when lower(c.class_0_type_coding_1_code) = lower('group') then c.class_0_type_coding_1_system
            when lower(c.class_1_type_coding_0_code) = lower('group') then c.class_1_type_coding_0_system
            when lower(c.class_1_type_coding_1_code) = lower('group') then c.class_1_type_coding_1_system
        end") }}                                                                     as class_group_system
    {#- Plan class: Get first matching class by index order (0, 1) -#}
    , {{ try_to_cast_string("case
            when lower(c.class_0_type_coding_0_code) = lower('plan') then c.class_0_value
            when lower(c.class_0_type_coding_1_code) = lower('plan') then c.class_0_value
            when lower(c.class_1_type_coding_0_code) = lower('plan') then c.class_1_value
            when lower(c.class_1_type_coding_1_code) = lower('plan') then c.class_1_value
        end") }}                                                                     as class_plan_code
    , {{ try_to_cast_string("case
            when lower(c.class_0_type_coding_0_code) = lower('plan') then c.class_0_type_coding_0_display
            when lower(c.class_0_type_coding_1_code) = lower('plan') then c.class_0_type_coding_1_display
            when lower(c.class_1_type_coding_0_code) = lower('plan') then c.class_1_type_coding_0_display
            when lower(c.class_1_type_coding_1_code) = lower('plan') then c.class_1_type_coding_1_display
        end") }}                                                                      as class_plan_display
    , {{ try_to_cast_string("case
            when lower(c.class_0_type_coding_0_code) = lower('plan') then c.class_0_type_coding_0_system
            when lower(c.class_0_type_coding_1_code) = lower('plan') then c.class_0_type_coding_1_system
            when lower(c.class_1_type_coding_0_code) = lower('plan') then c.class_1_type_coding_0_system
            when lower(c.class_1_type_coding_1_code) = lower('plan') then c.class_1_type_coding_1_system
        end") }}                                                                     as class_plan_system
    , {{ try_to_cast_string('c.meta_source') }}                                      as data_source
    {#- Data source extension: extension with data-source URL -#}
    , {{ try_to_cast_string(get_inline_extension(
            'c',
            'https://public.metriport.com/fhir/StructureDefinition/data-source.json',
            extension_max_index,
            'valuecoding_code',
            none,
            none
        )) }}                                                                         as data_source_ext
    , {{ try_to_cast_string('c.meta_source') }}                                       as meta_source
    , c.m_patient_id
    , c.m_job_id
    , c.m_created_at
    , c.m_updated_at
    , c.m_deleted_at
    , c.raw_to_core_job_id
from {{ref('stage__coverage')}} c
