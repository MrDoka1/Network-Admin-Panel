package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanAdminStatus;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanOperStatus;

@Schema(name = "Vlan")
public record VlanResponse(
        Short vlanId,
        String name,
        VlanAdminStatus adminStatus,
        VlanOperStatus operStatus,
        boolean isProtected
) {
}
