select 
        cast(id as {{ dbt.type_string() }} )                                                  as medication_id       -- RxNorm code and display
    ,   {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'code', 8) }}        as rxnorm_code
    ,   {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'system', 8) }}      as rxnorm_system
    ,   {{ get_coding_value('http://www.nlm.nih.gov/research/umls/rxnorm', 'display', 8) }}     as rxnorm_display

        -- NDC code and display
    ,   {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'code', 8) }}                        as ndc_code
    ,   {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'system', 8) }}                      as ndc_system
    ,   {{ get_coding_value('http://hl7.org/fhir/sid/ndc', 'display', 8) }}                     as ndc_display

        -- ATC code and display
    ,   {{ get_coding_value('http://www.whocc.no/atc', 'code', 8) }}                            as atc_code
    ,   {{ get_coding_value('http://www.whocc.no/atc', 'system', 8) }}                          as atc_system
    ,   {{ get_coding_value('http://www.whocc.no/atc', 'display', 8) }}                         as atc_display
    ,   cast(meta_source as {{ dbt.type_string() }} )                                           as data_source
from {{ref('stage__medication')}}
