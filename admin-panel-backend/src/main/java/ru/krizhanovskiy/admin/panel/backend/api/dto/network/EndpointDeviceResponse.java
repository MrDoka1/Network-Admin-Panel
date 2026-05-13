package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.NetworkDeviceStatus;

import java.util.UUID;

@Schema(name = "EndpointDevice")
public record EndpointDeviceResponse(
        UUID id,
        String hostname,
        NetworkDeviceStatus status
) {
}
