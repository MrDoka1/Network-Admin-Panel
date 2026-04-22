package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

@Schema(name = "LinkCreateRequest")
public record LinkCreateRequest(
        @NotNull UUID interfaceAId,
        @NotNull UUID interfaceBId
) {
}
