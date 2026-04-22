package ru.krizhanovskiy.admin.panel.backend.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI networkOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Admin Panel — сеть")
                        .description("REST API для устройств, VLAN, интерфейсов, линков и trunk")
                        .version("1.0.0"));
    }
}
