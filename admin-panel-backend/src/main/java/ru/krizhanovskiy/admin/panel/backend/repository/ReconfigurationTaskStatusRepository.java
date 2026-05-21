package ru.krizhanovskiy.admin.panel.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.krizhanovskiy.admin.panel.backend.domain.ReconfigurationTaskStatus;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ReconfigurationTaskStatusRepository extends JpaRepository<ReconfigurationTaskStatus, UUID> {

    List<ReconfigurationTaskStatus> findByTaskIdOrderByUpdatedAtDesc(UUID taskId);

    List<ReconfigurationTaskStatus> findByTaskIdAndBatchIdOrderByUpdatedAtDesc(UUID taskId, UUID batchId);

    @Query(
            value = """
                    SELECT DISTINCT ON (s.task_id, s.batch_id) s.*
                    FROM reconfiguration_task_status s
                    WHERE s.task_id IN (:taskIds)
                    ORDER BY s.task_id, s.batch_id, s.updated_at DESC
                    """,
            nativeQuery = true)
    List<ReconfigurationTaskStatus> findLatestByTaskIdIn(@Param("taskIds") Collection<UUID> taskIds);
}