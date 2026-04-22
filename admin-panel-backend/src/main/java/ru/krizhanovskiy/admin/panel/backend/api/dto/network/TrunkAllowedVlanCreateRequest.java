package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

@Schema(name = "TrunkAllowedVlanCreateRequest")
public record TrunkAllowedVlanCreateRequest(
        @NotNull @Min(1) @Max(4094) Short vlanId
) {
}
