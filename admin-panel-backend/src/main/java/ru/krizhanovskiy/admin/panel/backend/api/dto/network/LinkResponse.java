package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Schema(name = "Link")
public record LinkResponse(
        UUID id,
        UUID interfaceAId,
        UUID interfaceBId
) {
}
