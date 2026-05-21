package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanAdminStatus;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanOperStatus;

import java.util.UUID;

@Schema(name = "DeviceVlan")
public record DeviceVlanResponse(
        UUID deviceId,
        Short vlanId,
        String name,
        VlanAdminStatus adminStatus,
        VlanOperStatus operStatus
) {
}
