package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceType;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.NetworkDeviceStatus;

import java.util.UUID;

@Schema(name = "NetworkDevice")
public record NetworkDeviceResponse(
        UUID id,
        DeviceType deviceType,
        String hostname,
        String mgmtIp,
        NetworkDeviceStatus status
) {
}
