package com.metriport;

import com.metriport.generated.Metriport;
import org.junit.jupiter.api.Test;
import io.github.cdimascio.dotenv.Dotenv;

public class TestClient {

    @Test
    public void test_client() {
        Dotenv dotenv = Dotenv.load();
        Metriport metriport = Metriport.builder()
                .apiKey(dotenv.get("API_KEY"))
                .url(dotenv.get("BASE_URL"))
                .build();
        var response = metriport.medical().patient().list();
    }
}
