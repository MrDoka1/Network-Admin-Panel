package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

@Schema(name = "EndpointNetworkAttachmentCreateRequest")
public record EndpointNetworkAttachmentCreateRequest(
        @NotNull UUID networkInterfaceId,
        @NotNull UUID endpointInterfaceId
) {
}
