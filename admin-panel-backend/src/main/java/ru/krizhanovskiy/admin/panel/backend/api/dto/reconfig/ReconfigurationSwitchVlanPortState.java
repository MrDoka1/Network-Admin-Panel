package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReconfigurationSwitchVlanPortState")
public record ReconfigurationSwitchVlanPortState(int vlanId) {
}
