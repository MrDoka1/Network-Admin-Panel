package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonTypeName;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.UUID;

@JsonTypeName("EDIT_TRUNK")
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record EditTrunkReconfigAction(
        UUID id,
        UUID deviceId,
        ActionExecutionStatus status,
        EditTrunkParams params,
        EditTrunkState previousState,
        EditTrunkState targetState
) implements VlanReconfigAction {
}
