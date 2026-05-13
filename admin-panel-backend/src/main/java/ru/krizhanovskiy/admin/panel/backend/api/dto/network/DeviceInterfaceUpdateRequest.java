package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceInterfaceAdminStatus;

@Schema(name = "DeviceInterfaceUpdateRequest")
public record DeviceInterfaceUpdateRequest(
        @NotBlank @Size(max = 128) String name,
        @NotNull DeviceInterfaceAdminStatus adminStatus,
        @Schema(description = "VID 802.1Q; только для сабинтерфейса, иначе должен быть null")
        Short dot1qVlanId,
        @Schema(description = "Адрес L3 (inet) или null")
        @Size(max = 128)
        String ipAddress
) {
}
