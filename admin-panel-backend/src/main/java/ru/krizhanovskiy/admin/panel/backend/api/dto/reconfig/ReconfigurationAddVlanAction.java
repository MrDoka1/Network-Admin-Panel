package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import com.fasterxml.jackson.annotation.JsonTypeName;
import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ActionExecutionStatus;

import java.util.UUID;

@JsonTypeName("ADD_VLAN")
@Schema(name = "ReconfigurationAddVlanAction")
public record ReconfigurationAddVlanAction(
        UUID id,
        UUID deviceId,
        ActionExecutionStatus status,
        ReconfigurationAddVlanParams params
) implements ReconfigurationVlanAction {
}
