package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReconfigurationAddVlanParams")
public record ReconfigurationAddVlanParams(int vlanId, String name) {
}
