package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

public enum ReconfigurationEntityStatus {
    PENDING,
    AWAITING_CONFIRMATION,
    CONFIRMED,
    RUNNING,
    SUCCESS,
    FAILED,
    ROLLED_BACK,
    CANCEL
}
