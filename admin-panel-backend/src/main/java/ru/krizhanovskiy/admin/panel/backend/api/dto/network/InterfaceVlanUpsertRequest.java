package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.InterfaceVlanMode;

@Schema(name = "InterfaceVlanUpsertRequest")
public record InterfaceVlanUpsertRequest(
        @NotNull InterfaceVlanMode mode,
        Short accessVlanId,
        Short nativeVlanId
) {
}
