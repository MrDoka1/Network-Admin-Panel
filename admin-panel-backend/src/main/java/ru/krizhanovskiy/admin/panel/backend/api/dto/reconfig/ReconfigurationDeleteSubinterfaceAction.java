package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import com.fasterxml.jackson.annotation.JsonTypeName;
import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ActionExecutionStatus;

import java.util.UUID;

@JsonTypeName("DELETE_SUBINTERFACE")
@Schema(name = "ReconfigurationDeleteSubinterfaceAction")
public record ReconfigurationDeleteSubinterfaceAction(
        UUID id,
        UUID deviceId,
        ActionExecutionStatus status,
        ReconfigurationDeleteSubinterfaceParams params
) implements ReconfigurationVlanAction {
}
