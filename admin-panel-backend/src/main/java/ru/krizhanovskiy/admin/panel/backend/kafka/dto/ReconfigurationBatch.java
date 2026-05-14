package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;
import java.util.UUID;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ReconfigurationBatch(
        UUID id,
        BatchCriticality criticality,
        ReconfigurationEntityStatus status,
        List<VlanReconfigAction> actions
) {
}
