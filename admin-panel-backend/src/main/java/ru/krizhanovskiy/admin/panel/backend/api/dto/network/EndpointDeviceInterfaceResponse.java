package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceInterfaceAdminStatus;

import java.util.UUID;

@Schema(name = "EndpointDeviceInterface")
public record EndpointDeviceInterfaceResponse(
        UUID id,
        UUID endpointDeviceId,
        String name,
        String macAddress,
        DeviceInterfaceAdminStatus adminStatus,
        UUID networkInterfaceId
) {
}
