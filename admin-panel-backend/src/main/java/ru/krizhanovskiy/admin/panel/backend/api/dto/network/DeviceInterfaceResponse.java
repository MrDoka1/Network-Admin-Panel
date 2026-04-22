package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceInterfaceAdminStatus;

import java.util.UUID;

@Schema(name = "DeviceInterface")
public record DeviceInterfaceResponse(
        UUID id,
        UUID deviceId,
        String name,
        DeviceInterfaceAdminStatus adminStatus
) {
}
