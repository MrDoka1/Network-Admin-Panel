package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

import com.fasterxml.jackson.annotation.JsonTypeName;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.UUID;

@JsonTypeName("ADD_VLAN")
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record AddVlanReconfigAction(UUID id, UUID deviceId, ActionExecutionStatus status, AddVlanParams params)
        implements VlanReconfigAction {
}
