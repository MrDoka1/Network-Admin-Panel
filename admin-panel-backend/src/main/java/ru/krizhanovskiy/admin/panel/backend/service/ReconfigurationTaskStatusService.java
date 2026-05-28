package ru.krizhanovskiy.admin.panel.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.krizhanovskiy.admin.panel.backend.domain.ReconfigurationTaskStatus;
import ru.krizhanovskiy.admin.panel.backend.repository.ReconfigurationTaskStatusRepository;

import ru.krizhanovskiy.admin.panel.backend.domain.enums.ReconfigurationTaskExecutionStatus;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class ReconfigurationTaskStatusService {

    private final ReconfigurationTaskStatusRepository reconfigurationTaskStatusRepository;

    @Transactional(readOnly = true)
    public Map<UUID, TaskExecutionStatusBundle> loadLatestByTaskIds(Collection<UUID> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return Map.of();
        }
        List<ReconfigurationTaskStatus> rows =
                reconfigurationTaskStatusRepository.findLatestByTaskIdIn(taskIds);
        Map<UUID, TaskExecutionStatusBundle> result = new HashMap<>();
        for (ReconfigurationTaskStatus row : rows) {
            TaskExecutionStatusBundle bundle =
                    result.computeIfAbsent(row.getTaskId(), id -> new TaskExecutionStatusBundle());
            if (row.getBatchId() == null) {
                mergeLatest(bundle::taskStatus, bundle::setTaskStatus, row);
            } else {
                mergeLatest(
                        () -> bundle.batchStatuses().get(row.getBatchId()),
                        latest -> bundle.batchStatuses().put(row.getBatchId(), latest),
                        row);
            }
        }
        return result;
    }

    private static void mergeLatest(
            Supplier<ReconfigurationTaskStatus> current,
            Consumer<ReconfigurationTaskStatus> setter,
            ReconfigurationTaskStatus incoming) {
        ReconfigurationTaskStatus existing = current.get();
        if (existing == null || !existing.getUpdatedAt().isAfter(incoming.getUpdatedAt())) {
            setter.accept(incoming);
        }
    }

    @Transactional
    public ReconfigurationTaskStatus recordTaskLevelStatus(
            UUID taskId,
            ReconfigurationTaskExecutionStatus status,
            String updatedBy,
            String statusReason) {
        return recordTaskLevelStatus(taskId, status, updatedBy, statusReason, null);
    }

    @Transactional
    public ReconfigurationTaskStatus recordTaskLevelStatus(
            UUID taskId,
            ReconfigurationTaskExecutionStatus status,
            String updatedBy,
            String statusReason,
            Collection<UUID> batchIds) {
        if (status == ReconfigurationTaskExecutionStatus.CANCEL) {
            Objects.requireNonNull(
                    batchIds,
                    "При отмене задачи необходимо передать идентификаторы батчей для проставления статуса CANCEL");
        }
        Instant updatedAt = Instant.now();
        ReconfigurationTaskStatus row = newStatusRow(taskId, null, status, updatedAt, updatedBy, statusReason);
        ReconfigurationTaskStatus saved = reconfigurationTaskStatusRepository.save(row);
        if (status == ReconfigurationTaskExecutionStatus.CANCEL) {
            propagateCancelToBatches(taskId, batchIds, updatedAt, updatedBy, statusReason);
        }
        return saved;
    }

    @Transactional
    public ReconfigurationTaskStatus recordBatchLevelStatus(
            UUID taskId,
            UUID batchId,
            ReconfigurationTaskExecutionStatus status,
            String updatedBy,
            String statusReason) {
        ReconfigurationTaskStatus row =
                newStatusRow(taskId, batchId, status, Instant.now(), updatedBy, statusReason);
        return reconfigurationTaskStatusRepository.save(row);
    }

    private void propagateCancelToBatches(
            UUID taskId,
            Collection<UUID> batchIds,
            Instant updatedAt,
            String updatedBy,
            String statusReason) {
        for (UUID batchId : batchIds) {
            if (batchId == null) {
                continue;
            }
            reconfigurationTaskStatusRepository.save(
                    newStatusRow(
                            taskId,
                            batchId,
                            ReconfigurationTaskExecutionStatus.CANCEL,
                            updatedAt,
                            updatedBy,
                            statusReason));
        }
    }

    private static ReconfigurationTaskStatus newStatusRow(
            UUID taskId,
            UUID batchId,
            ReconfigurationTaskExecutionStatus status,
            Instant updatedAt,
            String updatedBy,
            String statusReason) {
        ReconfigurationTaskStatus row = new ReconfigurationTaskStatus();
        row.setTaskId(taskId);
        row.setBatchId(batchId);
        row.setStatus(status);
        row.setUpdatedAt(updatedAt);
        row.setUpdatedBy(updatedBy);
        row.setStatusReason(statusReason);
        return row;
    }

    public static final class TaskExecutionStatusBundle {
        private ReconfigurationTaskStatus taskStatus;
        private final Map<UUID, ReconfigurationTaskStatus> batchStatuses = new HashMap<>();

        public ReconfigurationTaskStatus taskStatus() {
            return taskStatus;
        }

        public void setTaskStatus(ReconfigurationTaskStatus taskStatus) {
            this.taskStatus = taskStatus;
        }

        public Map<UUID, ReconfigurationTaskStatus> batchStatuses() {
            return batchStatuses;
        }
    }
}
