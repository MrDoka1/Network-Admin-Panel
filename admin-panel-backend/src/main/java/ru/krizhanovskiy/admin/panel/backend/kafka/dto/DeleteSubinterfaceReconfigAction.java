package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

import com.fasterxml.jackson.annotation.JsonTypeName;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.UUID;

@JsonTypeName("DELETE_SUBINTERFACE")
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record DeleteSubinterfaceReconfigAction(
        UUID id,
        UUID deviceId,
        ActionExecutionStatus status,
        DeleteSubinterfaceParams params
) implements VlanReconfigAction {
}
