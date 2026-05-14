package ru.krizhanovskiy.admin.panel.backend.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;

import ru.krizhanovskiy.admin.panel.backend.kafka.dto.ReconfigurationTask;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Отправка и чтение сообщений с контрактом реконфигурации VLAN.
 * <p>
 * Kafka — журнал: «что сейчас в топике» читается как снимок с начала (или с указанных смещений),
 * а не как произвольный key-value. Для потоковой обработки используйте {@code @KafkaListener}.
 */
@Component
public class KafkaReconfigAdapter {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper = createObjectMapper();
    private final KafkaReconfigProperties properties;
    private final ConsumerFactory<String, String> snapshotConsumerFactory;

    public KafkaReconfigAdapter(
            KafkaTemplate<String, String> kafkaTemplate,
            KafkaReconfigProperties properties,
            @Qualifier("reconfigSnapshotConsumerFactory") ConsumerFactory<String, String> reconfigSnapshotConsumerFactory
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.properties = properties;
        this.snapshotConsumerFactory = reconfigSnapshotConsumerFactory;
    }

    private static ObjectMapper createObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        return mapper;
    }

    public String configuredTopic() {
        return properties.getTasksTopic();
    }

    public CompletableFuture<SendResult<String, String>> send(ReconfigurationTask operation) throws JsonProcessingException {
        return send(properties.getTasksTopic(), operation);
    }

    public CompletableFuture<SendResult<String, String>> send(String topic, ReconfigurationTask operation)
            throws JsonProcessingException {
        String json = objectMapper.writeValueAsString(operation);
        String key = operation.id() != null ? operation.id().toString() : null;
        return kafkaTemplate.send(topic, key, json);
    }

    /**
     * Читает сообщения с начала топика одним проходом (новый consumer group на каждый вызов).
     * Останавливается по таймауту простоя, лимиту записей или общему времени.
     */
    public List<ReconfigurationTask> readTopicSnapshot(Duration maxTotalWait, int maxRecords) {
        return readTopicSnapshot(properties.getTasksTopic(), maxTotalWait, maxRecords);
    }

    public List<ReconfigurationTask> readTopicSnapshot(String topic, Duration maxTotalWait, int maxRecords) {
        Map<String, Object> consumerProps = new HashMap<>(snapshotConsumerFactory.getConfigurationProperties());
        consumerProps.put(
                ConsumerConfig.GROUP_ID_CONFIG,
                properties.getSnapshotConsumerGroupPrefix() + UUID.randomUUID()
        );

        List<ReconfigurationTask> result = new ArrayList<>();
        long deadlineNanos = System.nanoTime() + maxTotalWait.toNanos();
        int consecutiveEmptyPolls = 0;
        final int emptyPollLimit = 4;

        try (Consumer<String, String> consumer = new KafkaConsumer<>(consumerProps)) {
            consumer.subscribe(List.of(topic));
            waitForAssignment(consumer, Duration.ofSeconds(10));

            for (TopicPartition partition : consumer.assignment()) {
                consumer.seekToBeginning(List.of(partition));
            }

            while (System.nanoTime() < deadlineNanos
                    && result.size() < maxRecords
                    && consecutiveEmptyPolls < emptyPollLimit) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
                if (records.isEmpty()) {
                    consecutiveEmptyPolls++;
                    continue;
                }
                consecutiveEmptyPolls = 0;
                for (ConsumerRecord<String, String> record : records) {
                    if (record.value() == null || record.value().isBlank()) {
                        continue;
                    }
                    try {
                        result.add(objectMapper.readValue(record.value(), ReconfigurationTask.class));
                    } catch (JsonProcessingException ignored) {
                        // пропускаем неподходящие сообщения (другой формат)
                    }
                    if (result.size() >= maxRecords) {
                        break;
                    }
                }
            }
        }
        return result;
    }

    private static void waitForAssignment(Consumer<String, String> consumer, Duration timeout) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (consumer.assignment().isEmpty() && System.nanoTime() < deadline) {
            consumer.poll(Duration.ofMillis(200));
        }
    }
}
