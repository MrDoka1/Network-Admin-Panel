package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.InterfacePortMode;

@Schema(name = "ReconfigurationPortStateAccess")
public record ReconfigurationPortStateAccess(InterfacePortMode mode, int vlanId) {
}
