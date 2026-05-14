package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ReconfigurationTask(
        UUID id,
        String initiatedBy,
        Instant createdAt,
        ReconfigurationEntityStatus status,
        List<ReconfigurationBatch> batches
) {
}
