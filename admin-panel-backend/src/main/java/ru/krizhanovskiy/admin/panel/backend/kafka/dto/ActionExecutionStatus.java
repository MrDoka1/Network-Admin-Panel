package ru.krizhanovskiy.admin.panel.backend.kafka.dto;

public enum ActionExecutionStatus {
    PENDING,
    EXECUTING,
    SUCCESS,
    FAILED,
    ROLLED_BACK
}
