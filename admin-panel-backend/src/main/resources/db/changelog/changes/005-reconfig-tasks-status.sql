--liquibase formatted sql

--changeset admin-panel:019-reconfiguration-task-status splitStatements:false
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reconfiguration_task_status'
CREATE TABLE reconfiguration_task_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL,
    batch_id uuid,
    status varchar(32) NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by varchar(64),
    status_reason text,
    CONSTRAINT ck_reconfiguration_task_status CHECK (
        status IN ('IN_PROGRESS', 'SUCCESS', 'FAILED', 'ROLLED_BACK', 'CANCEL')
    )
);
CREATE INDEX idx_reconfiguration_task_status_task_id ON reconfiguration_task_status (task_id);
CREATE INDEX idx_reconfiguration_task_status_task_batch ON reconfiguration_task_status (task_id, batch_id);
CREATE INDEX idx_reconfiguration_task_status_updated_at ON reconfiguration_task_status (task_id, updated_at DESC);
COMMENT ON TABLE reconfiguration_task_status IS 'Статус выполнения задачи реконфигурации (task_id) или батча (batch_id; NULL — уровень задачи)';
COMMENT ON COLUMN reconfiguration_task_status.batch_id IS 'Идентификатор батча; NULL — статус всей задачи';
COMMENT ON COLUMN reconfiguration_task_status.updated_by IS 'Автор последнего обновления статуса (логин пользователя или сервис)';
COMMENT ON COLUMN reconfiguration_task_status.status_reason IS 'Описание ошибки или причина отмены';
