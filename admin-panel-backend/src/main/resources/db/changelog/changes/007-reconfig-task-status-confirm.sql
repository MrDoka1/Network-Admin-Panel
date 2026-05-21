--liquibase formatted sql

--changeset admin-panel:021-reconfiguration-task-status-awaiting-confirm splitStatements:false
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reconfiguration_task_status'
ALTER TABLE reconfiguration_task_status DROP CONSTRAINT IF EXISTS ck_reconfiguration_task_status;
ALTER TABLE reconfiguration_task_status ADD CONSTRAINT ck_reconfiguration_task_status CHECK (
    status IN (
        'PENDING',
        'IN_PROGRESS',
        'SUCCESS',
        'FAILED',
        'ROLLED_BACK',
        'CANCEL',
        'AWAITING_CONFIRMATION',
        'CONFIRMED'
    )
);
