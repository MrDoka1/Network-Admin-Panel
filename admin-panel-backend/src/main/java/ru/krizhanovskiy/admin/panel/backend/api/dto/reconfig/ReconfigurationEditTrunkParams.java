package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(name = "ReconfigurationEditTrunkParams")
public record ReconfigurationEditTrunkParams(String port, List<Integer> allowedVlans, Integer nativeVlanId) {
}
