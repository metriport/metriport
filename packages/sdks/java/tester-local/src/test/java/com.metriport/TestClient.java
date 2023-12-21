package com.metriport;

import com.metriport.generated.Metriport;
import org.junit.jupiter.api.Test;
import io.github.cdimascio.dotenv.Dotenv;

public class TestClient {
    Dotenv dotenv = Dotenv.load();
    String api_key = dotenv.get("API_KEY");
    String base_url = dotenv.get("BASE_URL");

    @Test
    public void test_client() {
        Metriport metriport = Metriport.builder()
                .apiKey(api_key)
                .url(base_url)
                .build();
        var response = metriport.medical().patient().list();
    }
}
