package ru.krizhanovskiy.admin.panel.backend.api.dto.network;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanAdminStatus;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.VlanOperStatus;

@Schema(name = "VlanUpdateRequest")
public record VlanUpdateRequest(
        @Size(max = 256) String name,
        VlanAdminStatus adminStatus,
        VlanOperStatus operStatus
) {
}
