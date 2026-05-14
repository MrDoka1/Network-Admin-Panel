package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationEntityStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Schema(name = "ReconfigurationTask")
public record ReconfigurationTaskResponse(
        UUID id,
        String initiatedBy,
        Instant createdAt,
        ReconfigurationEntityStatus status,
        List<ReconfigurationBatchView> batches
) {
}
