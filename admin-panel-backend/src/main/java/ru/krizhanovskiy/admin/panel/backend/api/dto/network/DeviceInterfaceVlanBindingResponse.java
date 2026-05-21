package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.InterfaceVlanMode;

import java.util.List;

/**
 * Снимок строк {@code interface_vlan} и списка {@code trunk_allowed_vlan} для порта
 * (для UI реконфигурации и согласованности с инвентарём).
 */
@Schema(name = "DeviceInterfaceVlanBinding")
public record DeviceInterfaceVlanBindingResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) InterfaceVlanMode mode,
        Integer accessVlanId,
        Integer nativeVlanId,
        @Schema(description = "Разрешённые VLAN на trunk; для ACCESS обычно пусто")
        List<Integer> trunkAllowedVlanIds
) {
}
