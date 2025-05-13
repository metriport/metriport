// TODO eng-41 Convert this to actual code to create the index for hybrid search (lexical + neural/semantic)
/*
PUT /medical-resources
{
    "settings": {
        "index.knn": true,
        "default_pipeline": "embedding-ingest-pipeline",
        "index.search.default_pipeline": "hybrid-search-pipeline"
    },
    "mappings": {
        "properties": {
            "content_embedding": {
                "type": "knn_vector",
                "dimension": 768,
                "method": {
                    "name": "hnsw",
                    "space_type": "innerproduct",
                    "engine": "nmslib"
                }
            },
            "cxId": { "type": "keyword" },
            "patientId": { "type": "keyword" },
            "resourceType": { "type": "keyword" },
            "resourceId": { "type": "keyword" },
            "content": { "type": "text" }
        }
    }
}
*/
