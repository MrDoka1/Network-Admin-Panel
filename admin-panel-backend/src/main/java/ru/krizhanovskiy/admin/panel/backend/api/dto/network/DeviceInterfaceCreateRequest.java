package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.DeviceInterfaceAdminStatus;

import java.util.UUID;

@Schema(name = "DeviceInterfaceCreateRequest")
public record DeviceInterfaceCreateRequest(
        @Schema(description = "Имя; для сабинтерфейса можно не задавать — будет parent.vlanId")
        @Size(max = 128) String name,
        @NotNull DeviceInterfaceAdminStatus adminStatus,
        @Schema(description = "Родительский порт; null — физический интерфейс")
        UUID parentInterfaceId,
        @Schema(description = "VID 802.1Q; обязателен для сабинтерфейса")
        Short dot1qVlanId,
        @Schema(description = "Адрес L3 в формате PostgreSQL inet, например 192.168.0.1/24")
        @Size(max = 128)
        String ipAddress
) {
}
