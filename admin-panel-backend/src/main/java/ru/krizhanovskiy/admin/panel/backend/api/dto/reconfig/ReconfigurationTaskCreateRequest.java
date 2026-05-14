package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationEntityStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Schema(name = "ReconfigurationTaskCreateRequest")
public record ReconfigurationTaskCreateRequest(
        UUID id,
        String initiatedBy,
        Instant createdAt,
        ReconfigurationEntityStatus status,
        @NotEmpty @Valid List<@Valid ReconfigurationBatchView> batches
) {
}
