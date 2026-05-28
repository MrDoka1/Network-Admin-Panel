package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationEntityStatus;

import java.time.Instant;
import java.util.UUID;

@Schema(name = "ReconfigurationTaskStatusHistoryEntry")
public record ReconfigurationTaskStatusHistoryEntry(
        UUID id,
        UUID taskId,
        @Schema(description = "Идентификатор батча; null — изменение на уровне задачи")
        UUID batchId,
        ReconfigurationEntityStatus status,
        Instant updatedAt,
        String updatedBy,
        String statusReason
) {
}
