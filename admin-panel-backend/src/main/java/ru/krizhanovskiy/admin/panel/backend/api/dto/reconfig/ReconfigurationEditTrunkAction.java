package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonTypeName;
import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ActionExecutionStatus;

import java.util.UUID;

@JsonTypeName("EDIT_TRUNK")
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(name = "ReconfigurationEditTrunkAction")
public record ReconfigurationEditTrunkAction(
        UUID id,
        UUID deviceId,
        ActionExecutionStatus status,
        ReconfigurationEditTrunkParams params,
        ReconfigurationEditTrunkState previousState,
        ReconfigurationEditTrunkState targetState
) implements ReconfigurationVlanAction {
}
