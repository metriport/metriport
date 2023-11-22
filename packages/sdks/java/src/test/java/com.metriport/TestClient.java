package com.metriport;

import com.metriport.generated.Metriport;
import org.junit.jupiter.api.Test;

public class TestClient {

    @Test
    public void test_client() {
        Metriport metriport = Metriport.builder()
                .apiKey(System.getenv("METRIPORT_API_KEY"))
                .url("http://localhost:8080")
                .build();
        var response = metriport.medical().patient().list();
    }
}
