--liquibase formatted sql

--changeset admin-panel:001-network-device splitStatements:false
CREATE TABLE network_device (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_type varchar(32) NOT NULL,
    hostname varchar(255) NOT NULL,
    mgmt_ip varchar(64) NOT NULL,
    status varchar(32) NOT NULL,
    CONSTRAINT ck_network_device_type CHECK (device_type IN ('ROUTER', 'SWITCH')),
    CONSTRAINT ck_network_device_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
COMMENT ON TABLE network_device IS 'Сетевое устройство (общие поля для router/switch)';

--changeset admin-panel:002-vlan splitStatements:false
CREATE TABLE vlan (
    vlan_id smallint PRIMARY KEY,
    name varchar(256),
    admin_status varchar(32) NOT NULL DEFAULT 'ACTIVE',
    oper_status varchar(32),
    CONSTRAINT ck_vlan_id_range CHECK (vlan_id >= 1 AND vlan_id <= 4094),
    CONSTRAINT ck_vlan_admin_status CHECK (admin_status IN ('ACTIVE', 'SUSPENDED')),
    CONSTRAINT ck_vlan_oper_status CHECK (oper_status IS NULL OR oper_status IN ('UP', 'DOWN', 'UNKNOWN'))
);
COMMENT ON TABLE vlan IS 'VLAN; первичный ключ — номер VLAN (802.1Q VID)';

--changeset admin-panel:003-device-interface
CREATE TABLE device_interface (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id uuid NOT NULL REFERENCES network_device (id) ON DELETE CASCADE,
    name varchar(128) NOT NULL,
    admin_status varchar(16) NOT NULL,
    CONSTRAINT ck_device_interface_admin_status CHECK (admin_status IN ('UP', 'DOWN')),
    CONSTRAINT uq_device_interface_device_name UNIQUE (device_id, name)
);
CREATE INDEX idx_device_interface_device_id ON device_interface (device_id);
COMMENT ON TABLE device_interface IS 'Интерфейс устройства (порт, LAG и т.д.)';

--changeset admin-panel:004-link
CREATE TABLE link (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interface_a_id uuid NOT NULL REFERENCES device_interface (id) ON DELETE CASCADE,
    interface_b_id uuid NOT NULL REFERENCES device_interface (id) ON DELETE CASCADE,
    CONSTRAINT ck_link_distinct_interfaces CHECK (interface_a_id <> interface_b_id)
);
CREATE UNIQUE INDEX uq_link_interface_pair ON link (
    LEAST(interface_a_id, interface_b_id),
    GREATEST(interface_a_id, interface_b_id)
);
COMMENT ON TABLE link IS 'Соединение двух интерфейсов';

--changeset admin-panel:005-interface-vlan splitStatements:false
CREATE TABLE interface_vlan (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interface_id uuid NOT NULL UNIQUE REFERENCES device_interface (id) ON DELETE CASCADE,
    mode varchar(16) NOT NULL,
    access_vlan_id smallint REFERENCES vlan (vlan_id) ON DELETE RESTRICT,
    native_vlan_id smallint REFERENCES vlan (vlan_id) ON DELETE RESTRICT,
    CONSTRAINT ck_interface_vlan_mode CHECK (mode IN ('ACCESS', 'TRUNK')),
    CONSTRAINT ck_interface_vlan_access CHECK (
        mode <> 'ACCESS'
        OR (access_vlan_id IS NOT NULL AND native_vlan_id IS NULL)
    ),
    CONSTRAINT ck_interface_vlan_trunk CHECK (
        mode <> 'TRUNK'
        OR (access_vlan_id IS NULL)
    )
);
COMMENT ON TABLE interface_vlan IS 'Режим access/trunk и привязка VLAN на интерфейсе (одна строка на интерфейс)';

--changeset admin-panel:006-trunk-allowed-vlan splitStatements:false
CREATE TABLE trunk_allowed_vlan (
    interface_id uuid NOT NULL REFERENCES device_interface (id) ON DELETE CASCADE,
    vlan_id smallint NOT NULL REFERENCES vlan (vlan_id) ON DELETE RESTRICT,
    CONSTRAINT pk_trunk_allowed_vlan PRIMARY KEY (interface_id, vlan_id)
);
COMMENT ON TABLE trunk_allowed_vlan IS 'Разрешённые VLAN на trunk-порту';
