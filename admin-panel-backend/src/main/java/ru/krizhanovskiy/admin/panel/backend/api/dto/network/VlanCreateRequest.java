package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanAdminStatus;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanOperStatus;

@Schema(name = "VlanCreateRequest")
public record VlanCreateRequest(
        @NotNull @Min(1) @Max(4094) Short vlanId,
        @Size(max = 256) String name,
        VlanAdminStatus adminStatus,
        VlanOperStatus operStatus,
        Boolean isProtected
) {
}
