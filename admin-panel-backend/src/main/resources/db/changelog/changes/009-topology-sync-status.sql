--liquibase formatted sql

--changeset admin-panel:023-topology-sync-status splitStatements:false
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'topology_sync_status'
CREATE TABLE topology_sync_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status varchar(32) NOT NULL,
    last_full_sync_at timestamptz,
    devices_total int NOT NULL DEFAULT 0,
    devices_synced int NOT NULL DEFAULT 0,
    devices_failed int NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_topology_sync_status CHECK (
        status IN ('IN_PROGRESS', 'OK', 'FAILED')
    ),
    CONSTRAINT ck_topology_sync_status_devices_total CHECK (devices_total >= 0),
    CONSTRAINT ck_topology_sync_status_devices_synced CHECK (devices_synced >= 0),
    CONSTRAINT ck_topology_sync_status_devices_failed CHECK (devices_failed >= 0),
    CONSTRAINT ck_topology_sync_status_devices_counts CHECK (
        devices_synced + devices_failed <= devices_total
    )
);
CREATE INDEX idx_topology_sync_status_updated_at ON topology_sync_status (updated_at DESC);
COMMENT ON TABLE topology_sync_status IS 'Журнал синхронизации топологии с устройств; актуальное состояние — последняя запись по updated_at';
COMMENT ON COLUMN topology_sync_status.status IS 'IN_PROGRESS — идёт синхронизация; OK — успешно; FAILED — ошибка';
COMMENT ON COLUMN topology_sync_status.last_full_sync_at IS 'Время последней успешной полной синхронизации';
COMMENT ON COLUMN topology_sync_status.devices_total IS 'Всего устройств в текущем прогоне';
COMMENT ON COLUMN topology_sync_status.devices_synced IS 'Успешно синхронизировано в текущем прогоне';
COMMENT ON COLUMN topology_sync_status.devices_failed IS 'Ошибок в текущем прогоне';
