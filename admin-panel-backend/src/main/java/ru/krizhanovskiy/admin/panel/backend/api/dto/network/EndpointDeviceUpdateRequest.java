package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.NetworkDeviceStatus;

@Schema(name = "EndpointDeviceUpdateRequest")
public record EndpointDeviceUpdateRequest(
        @NotBlank @Size(max = 255) String hostname,
        @NotNull NetworkDeviceStatus status
) {
}
