package ru.krizhanovskiy.admin.panel.backend.mapper;

import org.springframework.stereotype.Component;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationAddVlanAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationAddVlanParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationBatchView;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationDeleteVlanAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationDeleteVlanParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationPortStateAccess;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationPortStateTrunk;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationSetAccessAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationSetAccessParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationSetTrunkAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationSetTrunkParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationSwitchVlanAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationSwitchVlanParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationSwitchVlanPortState;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationTaskResponse;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationVlanAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.AddVlanParams;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.AddVlanReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.DeleteVlanParams;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.DeleteVlanReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.PortStateAccess;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.PortStateTrunk;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationBatch;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationTask;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.SetAccessParams;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.SetAccessReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.SetTrunkParams;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.SetTrunkReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.SwitchVlanParams;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.SwitchVlanPortState;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.SwitchVlanReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.VlanReconfigAction;

@Component
public class ReconfigurationTaskMapper {

    public ReconfigurationTaskResponse toResponse(ReconfigurationTask source) {
        return new ReconfigurationTaskResponse(
                source.id(),
                source.initiatedBy(),
                source.createdAt(),
                source.status(),
                source.batches().stream().map(this::toBatchView).toList()
        );
    }

    public ReconfigurationBatch toKafkaBatch(ReconfigurationBatchView view) {
        return new ReconfigurationBatch(
                view.id(),
                view.criticality(),
                view.status(),
                view.actions().stream().map(this::toKafkaAction).toList()
        );
    }

    public ReconfigurationBatchView toBatchView(ReconfigurationBatch batch) {
        return new ReconfigurationBatchView(
                batch.id(),
                batch.criticality(),
                batch.status(),
                batch.actions().stream().map(this::toApiAction).toList()
        );
    }

    public VlanReconfigAction toKafkaAction(ReconfigurationVlanAction action) {
        if (action instanceof ReconfigurationAddVlanAction a) {
            return new AddVlanReconfigAction(a.id(), a.deviceId(), a.status(), new AddVlanParams(a.params().vlanId(), a.params().name()));
        }
        if (action instanceof ReconfigurationDeleteVlanAction a) {
            return new DeleteVlanReconfigAction(a.id(), a.deviceId(), a.status(), new DeleteVlanParams(a.params().vlanId()));
        }
        if (action instanceof ReconfigurationSetAccessAction a) {
            return new SetAccessReconfigAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new SetAccessParams(a.params().port(), a.params().vlanId()),
                    a.previousState() != null ? toKafkaPortStateTrunk(a.previousState()) : null,
                    a.targetState() != null ? toKafkaPortStateAccess(a.targetState()) : null
            );
        }
        if (action instanceof ReconfigurationSetTrunkAction a) {
            return new SetTrunkReconfigAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new SetTrunkParams(a.params().port(), a.params().allowedVlans(), a.params().nativeVlanId()),
                    a.previousState() != null ? toKafkaPortStateAccess(a.previousState()) : null,
                    a.targetState() != null ? toKafkaPortStateTrunk(a.targetState()) : null
            );
        }
        if (action instanceof ReconfigurationSwitchVlanAction a) {
            return new SwitchVlanReconfigAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new SwitchVlanParams(a.params().port(), a.params().targetVlanId()),
                    a.previousState() != null ? toKafkaSwitchVlanPortState(a.previousState()) : null,
                    a.targetState() != null ? toKafkaSwitchVlanPortState(a.targetState()) : null
            );
        }
        throw new IllegalArgumentException("Неизвестный тип действия: " + action.getClass().getName());
    }

    public ReconfigurationVlanAction toApiAction(VlanReconfigAction action) {
        if (action instanceof AddVlanReconfigAction a) {
            return new ReconfigurationAddVlanAction(
                    a.id(), a.deviceId(), a.status(),
                    new ReconfigurationAddVlanParams(a.params().vlanId(), a.params().name())
            );
        }
        if (action instanceof DeleteVlanReconfigAction a) {
            return new ReconfigurationDeleteVlanAction(
                    a.id(), a.deviceId(), a.status(),
                    new ReconfigurationDeleteVlanParams(a.params().vlanId())
            );
        }
        if (action instanceof SetAccessReconfigAction a) {
            return new ReconfigurationSetAccessAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new ReconfigurationSetAccessParams(a.params().port(), a.params().vlanId()),
                    a.previousState() != null ? toApiPortStateTrunk(a.previousState()) : null,
                    a.targetState() != null ? toApiPortStateAccess(a.targetState()) : null
            );
        }
        if (action instanceof SetTrunkReconfigAction a) {
            return new ReconfigurationSetTrunkAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new ReconfigurationSetTrunkParams(a.params().port(), a.params().allowedVlans(), a.params().nativeVlanId()),
                    a.previousState() != null ? toApiPortStateAccess(a.previousState()) : null,
                    a.targetState() != null ? toApiPortStateTrunk(a.targetState()) : null
            );
        }
        if (action instanceof SwitchVlanReconfigAction a) {
            return new ReconfigurationSwitchVlanAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new ReconfigurationSwitchVlanParams(a.params().port(), a.params().targetVlanId()),
                    a.previousState() != null ? toApiSwitchVlanPortState(a.previousState()) : null,
                    a.targetState() != null ? toApiSwitchVlanPortState(a.targetState()) : null
            );
        }
        throw new IllegalArgumentException("Неизвестный тип действия: " + action.getClass().getName());
    }

    private static PortStateAccess toKafkaPortStateAccess(ReconfigurationPortStateAccess s) {
        return new PortStateAccess(s.mode(), s.vlanId());
    }

    private static PortStateTrunk toKafkaPortStateTrunk(ReconfigurationPortStateTrunk s) {
        return new PortStateTrunk(s.mode(), s.allowedVlans());
    }

    private static SwitchVlanPortState toKafkaSwitchVlanPortState(ReconfigurationSwitchVlanPortState s) {
        return new SwitchVlanPortState(s.vlanId());
    }

    private static ReconfigurationPortStateAccess toApiPortStateAccess(PortStateAccess s) {
        return new ReconfigurationPortStateAccess(s.mode(), s.vlanId());
    }

    private static ReconfigurationPortStateTrunk toApiPortStateTrunk(PortStateTrunk s) {
        return new ReconfigurationPortStateTrunk(s.mode(), s.allowedVlans());
    }

    private static ReconfigurationSwitchVlanPortState toApiSwitchVlanPortState(SwitchVlanPortState s) {
        return new ReconfigurationSwitchVlanPortState(s.vlanId());
    }
}
