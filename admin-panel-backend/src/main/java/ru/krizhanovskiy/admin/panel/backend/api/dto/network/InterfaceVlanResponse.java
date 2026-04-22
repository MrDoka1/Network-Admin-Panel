package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.InterfaceVlanMode;

import java.util.UUID;

@Schema(name = "InterfaceVlan")
public record InterfaceVlanResponse(
        UUID id,
        UUID interfaceId,
        InterfaceVlanMode mode,
        Short accessVlanId,
        Short nativeVlanId
) {
}
