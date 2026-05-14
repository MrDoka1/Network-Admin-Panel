package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonTypeName;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.UUID;

@JsonTypeName("SET_ACCESS")
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record SetAccessReconfigAction(
        UUID id,
        UUID deviceId,
        ActionExecutionStatus status,
        SetAccessParams params,
        PortStateTrunk previousState,
        PortStateAccess targetState
) implements VlanReconfigAction {
}
