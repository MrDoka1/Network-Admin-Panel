package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record CreateSubinterfaceParams(String parentInterface, int vlanId, String ipAddress) {
}
