package ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ActionExecutionStatus;

import java.util.UUID;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXTERNAL_PROPERTY, property = "actionType")
@JsonSubTypes({
        @JsonSubTypes.Type(value = ReconfigurationAddVlanAction.class, name = "ADD_VLAN"),
        @JsonSubTypes.Type(value = ReconfigurationDeleteVlanAction.class, name = "DELETE_VLAN"),
        @JsonSubTypes.Type(value = ReconfigurationSetAccessAction.class, name = "SET_ACCESS"),
        @JsonSubTypes.Type(value = ReconfigurationSetTrunkAction.class, name = "SET_TRUNK"),
        @JsonSubTypes.Type(value = ReconfigurationEditTrunkAction.class, name = "EDIT_TRUNK"),
        @JsonSubTypes.Type(value = ReconfigurationSwitchVlanAction.class, name = "SWITCH_VLAN"),
        @JsonSubTypes.Type(value = ReconfigurationCreateSubinterfaceAction.class, name = "CREATE_SUBINTERFACE"),
        @JsonSubTypes.Type(value = ReconfigurationDeleteSubinterfaceAction.class, name = "DELETE_SUBINTERFACE")
})
public sealed interface ReconfigurationVlanAction permits ReconfigurationAddVlanAction, ReconfigurationDeleteVlanAction,
        ReconfigurationSetAccessAction, ReconfigurationSetTrunkAction, ReconfigurationEditTrunkAction,
        ReconfigurationSwitchVlanAction, ReconfigurationCreateSubinterfaceAction, ReconfigurationDeleteSubinterfaceAction {

    UUID id();

    UUID deviceId();

    ActionExecutionStatus status();
}
