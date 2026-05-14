package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.InterfacePortMode;

import java.util.List;

@Schema(name = "ReconfigurationPortStateTrunk")
public record ReconfigurationPortStateTrunk(InterfacePortMode mode, List<Integer> allowedVlans) {
}
