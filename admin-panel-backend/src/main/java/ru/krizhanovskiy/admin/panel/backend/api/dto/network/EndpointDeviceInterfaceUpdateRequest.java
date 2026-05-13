package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceInterfaceAdminStatus;

@Schema(name = "EndpointDeviceInterfaceUpdateRequest")
public record EndpointDeviceInterfaceUpdateRequest(
        @NotBlank @Size(max = 128) String name,
        @NotBlank @Size(max = 32) String macAddress,
        @NotNull DeviceInterfaceAdminStatus adminStatus
) {
}
