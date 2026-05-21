package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.BatchCriticality;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationEntityStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Schema(name = "ReconfigurationBatch")
public record ReconfigurationBatchView(
        UUID id,
        BatchCriticality criticality,
        ReconfigurationEntityStatus status,
        @Schema(description = "Время последнего обновления статуса батча в БД")
        Instant updatedAt,
        @NotEmpty @Valid List<@Valid ReconfigurationVlanAction> actions
) {
}
