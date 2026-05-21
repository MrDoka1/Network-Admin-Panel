package ru.krizhanovskiy.admin.panel.backend.domain.enums;

public enum ReconfigurationTaskExecutionStatus {
    PENDING,
    IN_PROGRESS,
    SUCCESS,
    FAILED,
    ROLLED_BACK,
    CANCEL,
    AWAITING_CONFIRMATION,
    CONFIRMED
}
