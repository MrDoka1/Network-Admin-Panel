package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import java.util.UUID;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXTERNAL_PROPERTY, property = "action_type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = AddVlanReconfigAction.class, name = "ADD_VLAN"),
        @JsonSubTypes.Type(value = DeleteVlanReconfigAction.class, name = "DELETE_VLAN"),
        @JsonSubTypes.Type(value = SetAccessReconfigAction.class, name = "SET_ACCESS"),
        @JsonSubTypes.Type(value = SetTrunkReconfigAction.class, name = "SET_TRUNK"),
        @JsonSubTypes.Type(value = EditTrunkReconfigAction.class, name = "EDIT_TRUNK"),
        @JsonSubTypes.Type(value = SwitchVlanReconfigAction.class, name = "SWITCH_VLAN"),
        @JsonSubTypes.Type(value = CreateSubinterfaceReconfigAction.class, name = "CREATE_SUBINTERFACE"),
        @JsonSubTypes.Type(value = DeleteSubinterfaceReconfigAction.class, name = "DELETE_SUBINTERFACE")
})
public sealed interface VlanReconfigAction permits AddVlanReconfigAction, DeleteVlanReconfigAction, SetAccessReconfigAction,
        SetTrunkReconfigAction, EditTrunkReconfigAction, SwitchVlanReconfigAction, CreateSubinterfaceReconfigAction,
        DeleteSubinterfaceReconfigAction {

    UUID id();

    UUID deviceId();

    ActionExecutionStatus status();
}
