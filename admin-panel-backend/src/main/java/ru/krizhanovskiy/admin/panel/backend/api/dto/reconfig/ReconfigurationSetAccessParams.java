package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReconfigurationSetAccessParams")
public record ReconfigurationSetAccessParams(String port, int vlanId) {
}
