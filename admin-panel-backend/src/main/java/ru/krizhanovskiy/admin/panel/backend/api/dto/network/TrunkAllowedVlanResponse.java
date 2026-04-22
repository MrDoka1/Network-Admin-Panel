package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Schema(name = "TrunkAllowedVlan")
public record TrunkAllowedVlanResponse(
        UUID interfaceId,
        Short vlanId
) {
}
