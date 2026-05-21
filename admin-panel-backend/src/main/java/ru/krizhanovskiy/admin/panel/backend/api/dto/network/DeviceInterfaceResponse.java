package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceInterfaceAdminStatus;

import java.util.UUID;

@Schema(name = "DeviceInterface")
public record DeviceInterfaceResponse(
        UUID id,
        UUID deviceId,
        String name,
        DeviceInterfaceAdminStatus adminStatus,
        UUID parentInterfaceId,
        Short dot1qVlanId,
        String ipAddress,
        @Schema(description = "Режим access/trunk и VLAN из БД; null если для порта нет строки interface_vlan")
        DeviceInterfaceVlanBindingResponse vlanBinding
) {
}
