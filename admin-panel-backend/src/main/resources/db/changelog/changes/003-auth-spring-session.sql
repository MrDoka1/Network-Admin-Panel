--liquibase formatted sql

--changeset admin-panel:010-users splitStatements:false
-- Таблица пользователей (логическая сущность user; имя users — избегаем ключевого слова USER в PostgreSQL)
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    login varchar(64) NOT NULL,
    password_hash varchar(255) NOT NULL,
    first_name varchar(255) NOT NULL,
    last_name varchar(255) NOT NULL,
    CONSTRAINT uq_users_login UNIQUE (login)
);
COMMENT ON TABLE users IS 'Учётная запись: логин, хэш пароля, имя и фамилия';

--changeset admin-panel:011-roles splitStatements:false
-- Роль (логическая сущность role; имя roles — избегаем ключевого слова ROLE)
CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(64) NOT NULL,
    CONSTRAINT uq_roles_name UNIQUE (name)
);
COMMENT ON TABLE roles IS 'Роль (например ADMIN)';

--changeset admin-panel:012-user-role-link splitStatements:false
CREATE TABLE user_role_link (
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT pk_user_role_link PRIMARY KEY (user_id, role_id)
);
CREATE INDEX idx_user_role_link_role_id ON user_role_link (role_id);
COMMENT ON TABLE user_role_link IS 'Связь пользователь — роль (M:N)';

--changeset admin-panel:013-spring-session splitStatements:false
CREATE TABLE SPRING_SESSION (
    PRIMARY_ID CHAR(36) NOT NULL,
    SESSION_ID CHAR(36) NOT NULL,
    CREATION_TIME BIGINT NOT NULL,
    LAST_ACCESS_TIME BIGINT NOT NULL,
    MAX_INACTIVE_INTERVAL INT NOT NULL,
    EXPIRY_TIME BIGINT NOT NULL,
    PRINCIPAL_NAME VARCHAR(100),
    CONSTRAINT SPRING_SESSION_PK PRIMARY KEY (PRIMARY_ID)
);
CREATE UNIQUE INDEX SPRING_SESSION_IX1 ON SPRING_SESSION (SESSION_ID);
CREATE INDEX SPRING_SESSION_IX2 ON SPRING_SESSION (EXPIRY_TIME);
CREATE INDEX SPRING_SESSION_IX3 ON SPRING_SESSION (PRINCIPAL_NAME);
COMMENT ON TABLE SPRING_SESSION IS 'Spring Session JDBC';

--changeset admin-panel:014-spring-session-attributes splitStatements:false
CREATE TABLE SPRING_SESSION_ATTRIBUTES (
    SESSION_PRIMARY_ID CHAR(36) NOT NULL,
    ATTRIBUTE_NAME VARCHAR(200) NOT NULL,
    ATTRIBUTE_BYTES BYTEA NOT NULL,
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_FK FOREIGN KEY (SESSION_PRIMARY_ID) REFERENCES SPRING_SESSION (PRIMARY_ID) ON DELETE CASCADE
);
COMMENT ON TABLE SPRING_SESSION_ATTRIBUTES IS 'Атрибуты сессии Spring Session';

--changeset admin-panel:015-seed-admin-role splitStatements:false
INSERT INTO roles (id, name)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'ADMIN');

--changeset admin-panel:016-seed-admin-user splitStatements:false
INSERT INTO users (id, login, password_hash, first_name, last_name)
VALUES (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'admin',
    '$2a$12$ZY9TrJAnmiq4XPP7Z46OpurB4y3wCNv6vXXz9Bt4CX5pviyg5q7Ji',
    'Admin',
    'Admin'
);

--changeset admin-panel:017-seed-admin-user-role splitStatements:false
INSERT INTO user_role_link (user_id, role_id)
VALUES (
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
);
