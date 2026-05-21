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
        @Schema(description = "Время последнего обновления статуса в БД")
        Instant updatedAt,
        @Schema(description = "Автор последнего обновления статуса в БД")
        String updatedBy,
        @Schema(description = "Описание ошибки или причина отмены из БД")
        String statusReason,
        List<ReconfigurationBatchView> batches
) {
}
