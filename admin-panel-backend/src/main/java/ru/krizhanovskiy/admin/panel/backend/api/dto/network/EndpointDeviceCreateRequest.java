package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.NetworkDeviceStatus;

@Schema(name = "EndpointDeviceCreateRequest")
public record EndpointDeviceCreateRequest(
        @NotBlank @Size(max = 255) String hostname,
        NetworkDeviceStatus status
) {
}
