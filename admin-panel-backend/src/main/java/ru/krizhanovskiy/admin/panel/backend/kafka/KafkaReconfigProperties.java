package ru.krizhanovskiy.admin.panel.backend.kafka;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.kafka")
public class KafkaReconfigProperties {

    /**
     * Имя топика задач реконфигурации (в Docker: {@code KAFKA_TASKS_TOPIC}, например {@code reconfig.tasks}).
     */
    private String tasksTopic = "reconfig.tasks";

    /**
     * Префикс group.id для одноразового чтения снимка топика (к полному имени добавляется UUID).
     */
    private String snapshotConsumerGroupPrefix = "admin-panel-reconfig-snapshot-";

    public String getTasksTopic() {
        return tasksTopic;
    }

    public void setTasksTopic(String tasksTopic) {
        this.tasksTopic = tasksTopic;
    }

    public String getSnapshotConsumerGroupPrefix() {
        return snapshotConsumerGroupPrefix;
    }

    public void setSnapshotConsumerGroupPrefix(String snapshotConsumerGroupPrefix) {
        this.snapshotConsumerGroupPrefix = snapshotConsumerGroupPrefix;
    }
}
