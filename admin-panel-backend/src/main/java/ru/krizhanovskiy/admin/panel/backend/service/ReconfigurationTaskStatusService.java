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
        ReconfigurationTaskStatus row = new ReconfigurationTaskStatus();
        row.setTaskId(taskId);
        row.setBatchId(null);
        row.setStatus(status);
        row.setUpdatedAt(Instant.now());
        row.setUpdatedBy(updatedBy);
        row.setStatusReason(statusReason);
        return reconfigurationTaskStatusRepository.save(row);
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
