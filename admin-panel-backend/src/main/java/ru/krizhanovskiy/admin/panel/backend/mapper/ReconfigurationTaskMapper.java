package ru.krizhanovskiy.admin.panel.backend.mapper;

import org.springframework.stereotype.Component;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationAddVlanAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationAddVlanParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationBatchView;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationCreateSubinterfaceAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationCreateSubinterfaceParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationDeleteSubinterfaceAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationDeleteSubinterfaceParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationDeleteVlanAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationDeleteVlanParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationEditTrunkAction;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationEditTrunkParams;
import ru.krizhanovskiy.admin.panel.backend.api.dto.reconfig.ReconfigurationEditTrunkState;
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
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.CreateSubinterfaceParams;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.CreateSubinterfaceReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.DeleteSubinterfaceParams;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.DeleteSubinterfaceReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.DeleteVlanParams;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.DeleteVlanReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.EditTrunkParams;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.EditTrunkReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.EditTrunkState;
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
import ru.krizhanovskiy.admin.panel.backend.domain.ReconfigurationTaskStatus;
import ru.krizhanovskiy.admin.panel.backend.domain.enums.ReconfigurationTaskExecutionStatus;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationEntityStatus;
import ru.krizhanovskiy.admin.panel.backend.kafka.dto.VlanReconfigAction;
import ru.krizhanovskiy.admin.panel.backend.service.ReconfigurationTaskStatusService.TaskExecutionStatusBundle;

import java.util.Map;
import java.util.UUID;

@Component
public class ReconfigurationTaskMapper {

    public ReconfigurationTaskResponse toResponse(ReconfigurationTask source) {
        return toResponse(source, null);
    }

    public ReconfigurationEntityStatus effectiveTaskStatus(
            ReconfigurationTask source, TaskExecutionStatusBundle bundle) {
        ReconfigurationTaskStatus taskDb = bundle != null ? bundle.taskStatus() : null;
        return resolveStatus(source.status(), taskDb);
    }

    public ReconfigurationEntityStatus effectiveBatchStatus(
            ReconfigurationBatch batch, TaskExecutionStatusBundle bundle) {
        ReconfigurationTaskStatus batchDb =
                bundle != null ? bundle.batchStatuses().get(batch.id()) : null;
        return resolveStatus(batch.status(), batchDb);
    }

    public boolean isTaskCancellable(ReconfigurationTask task, TaskExecutionStatusBundle bundle) {
        ReconfigurationEntityStatus effective = effectiveTaskStatus(task, bundle);
        if (effective == ReconfigurationEntityStatus.PENDING
                || effective == ReconfigurationEntityStatus.AWAITING_CONFIRMATION) {
            return true;
        }
        if (effective == ReconfigurationEntityStatus.RUNNING) {
            return task.batches().stream()
                    .allMatch(batch -> effectiveBatchStatus(batch, bundle) == ReconfigurationEntityStatus.PENDING);
        }
        return false;
    }

    public ReconfigurationTaskResponse toResponse(
            ReconfigurationTask source, Map<UUID, TaskExecutionStatusBundle> statusByTaskId) {
        TaskExecutionStatusBundle bundle =
                statusByTaskId != null ? statusByTaskId.get(source.id()) : null;
        ReconfigurationTaskStatus taskDb = bundle != null ? bundle.taskStatus() : null;
        return new ReconfigurationTaskResponse(
                source.id(),
                source.initiatedBy(),
                source.createdAt(),
                effectiveTaskStatus(source, bundle),
                taskDb != null ? taskDb.getUpdatedAt() : null,
                taskDb != null ? taskDb.getUpdatedBy() : null,
                taskDb != null ? taskDb.getStatusReason() : null,
                source.batches().stream()
                        .map(batch -> toBatchView(batch, bundle))
                        .toList());
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
        return toBatchView(batch, null);
    }

    public ReconfigurationBatchView toBatchView(ReconfigurationBatch batch, TaskExecutionStatusBundle bundle) {
        ReconfigurationTaskStatus batchDb =
                bundle != null ? bundle.batchStatuses().get(batch.id()) : null;
        return new ReconfigurationBatchView(
                batch.id(),
                batch.criticality(),
                resolveStatus(batch.status(), batchDb),
                batchDb != null ? batchDb.getUpdatedAt() : null,
                batch.actions().stream().map(this::toApiAction).toList());
    }

    private static ReconfigurationEntityStatus resolveStatus(
            ReconfigurationEntityStatus kafkaStatus, ReconfigurationTaskStatus dbRow) {
        if (dbRow == null) {
            return kafkaStatus;
        }
        return toEntityStatus(dbRow.getStatus());
    }

    private static ReconfigurationEntityStatus toEntityStatus(ReconfigurationTaskExecutionStatus status) {
        return switch (status) {
            case PENDING -> ReconfigurationEntityStatus.PENDING;
            case IN_PROGRESS -> ReconfigurationEntityStatus.RUNNING;
            case SUCCESS -> ReconfigurationEntityStatus.SUCCESS;
            case FAILED -> ReconfigurationEntityStatus.FAILED;
            case ROLLED_BACK -> ReconfigurationEntityStatus.ROLLED_BACK;
            case CANCEL -> ReconfigurationEntityStatus.CANCEL;
            case AWAITING_CONFIRMATION -> ReconfigurationEntityStatus.AWAITING_CONFIRMATION;
            case CONFIRMED -> ReconfigurationEntityStatus.CONFIRMED;
        };
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
        if (action instanceof ReconfigurationEditTrunkAction a) {
            return new EditTrunkReconfigAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new EditTrunkParams(a.params().port(), a.params().allowedVlans(), a.params().nativeVlanId()),
                    a.previousState() != null ? toKafkaEditTrunkState(a.previousState()) : null,
                    a.targetState() != null ? toKafkaEditTrunkState(a.targetState()) : null
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
        if (action instanceof ReconfigurationCreateSubinterfaceAction a) {
            return new CreateSubinterfaceReconfigAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new CreateSubinterfaceParams(
                            a.params().parentInterface(),
                            a.params().vlanId(),
                            a.params().ipAddress()
                    )
            );
        }
        if (action instanceof ReconfigurationDeleteSubinterfaceAction a) {
            return new DeleteSubinterfaceReconfigAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new DeleteSubinterfaceParams(a.params().parentInterface(), a.params().vlanId())
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
        if (action instanceof EditTrunkReconfigAction a) {
            return new ReconfigurationEditTrunkAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new ReconfigurationEditTrunkParams(a.params().port(), a.params().allowedVlans(), a.params().nativeVlanId()),
                    a.previousState() != null ? toApiEditTrunkState(a.previousState()) : null,
                    a.targetState() != null ? toApiEditTrunkState(a.targetState()) : null
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
        if (action instanceof CreateSubinterfaceReconfigAction a) {
            return new ReconfigurationCreateSubinterfaceAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new ReconfigurationCreateSubinterfaceParams(
                            a.params().parentInterface(),
                            a.params().vlanId(),
                            a.params().ipAddress()
                    )
            );
        }
        if (action instanceof DeleteSubinterfaceReconfigAction a) {
            return new ReconfigurationDeleteSubinterfaceAction(
                    a.id(),
                    a.deviceId(),
                    a.status(),
                    new ReconfigurationDeleteSubinterfaceParams(
                            a.params().parentInterface(),
                            a.params().vlanId()
                    )
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

    private static EditTrunkState toKafkaEditTrunkState(ReconfigurationEditTrunkState s) {
        return new EditTrunkState(s.allowedVlans(), s.nativeVlanId());
    }

    private static ReconfigurationEditTrunkState toApiEditTrunkState(EditTrunkState s) {
        return new ReconfigurationEditTrunkState(s.allowedVlans(), s.nativeVlanId());
    }
}
