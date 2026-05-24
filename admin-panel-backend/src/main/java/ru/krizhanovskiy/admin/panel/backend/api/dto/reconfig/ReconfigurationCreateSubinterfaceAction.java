package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import com.fasterxml.jackson.annotation.JsonTypeName;
import io.swagger.v3.oas.annotations.media.Schema;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ActionExecutionStatus;

import java.util.UUID;

@JsonTypeName("CREATE_SUBINTERFACE")
@Schema(name = "ReconfigurationCreateSubinterfaceAction")
public record ReconfigurationCreateSubinterfaceAction(
        UUID id,
        UUID deviceId,
        ActionExecutionStatus status,
        ReconfigurationCreateSubinterfaceParams params
) implements ReconfigurationVlanAction {
}
