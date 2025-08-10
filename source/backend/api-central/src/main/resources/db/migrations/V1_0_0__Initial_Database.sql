CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS api_central;

DROP TABLE IF EXISTS api_central.tb_program_card CASCADE;
DROP TABLE IF EXISTS api_central.tb_user CASCADE;
DROP TABLE IF EXISTS api_central.tb_vehicle CASCADE;
DROP TABLE IF EXISTS api_central.tb_activity CASCADE;


CREATE TABLE api_central.tb_program_card
(
    id_program_card     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_title            varchar(255) NOT NULL,
    dt_shift_start      timestamp without time zone,
    dt_shift_end        timestamp without time zone,
    tx_sector           text,
    tx_criminal_focus   varchar(255),
    is_active           boolean      NOT NULL,
    id_user_assigned    uuid,
    id_vehicle_assigned uuid
);

CREATE TABLE api_central.tb_user
(
    id_user         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_name         varchar(255) NOT NULL,
    tx_rank         varchar(255) NOT NULL,
    is_manager      boolean      NOT NULL,
    id_program_card uuid
);

CREATE TABLE api_central.tb_vehicle
(
    id_vehicle      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_plate        varchar(255) NOT NULL,
    id_program_card uuid
);

CREATE TABLE api_central.tb_activity
(
    id_activity     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_place        text,
    dt_time         timestamp without time zone,
    tx_activity     varchar(255),
    tx_notes        text,
    id_program_card uuid
);

ALTER TABLE api_central.tb_program_card
    ADD CONSTRAINT fk_tb_program_card_user
        FOREIGN KEY (id_user_assigned)
            REFERENCES api_central.tb_user (id_user)
            ON UPDATE CASCADE
            ON DELETE SET NULL;

ALTER TABLE api_central.tb_program_card
    ADD CONSTRAINT fk_tb_program_card_vehicle
        FOREIGN KEY (id_vehicle_assigned)
            REFERENCES api_central.tb_vehicle (id_vehicle)
            ON UPDATE CASCADE
            ON DELETE SET NULL;

ALTER TABLE api_central.tb_user
    ADD CONSTRAINT fk_tb_user_program_card
        FOREIGN KEY (id_program_card)
            REFERENCES api_central.tb_program_card (id_program_card)
            ON UPDATE CASCADE
            ON DELETE SET NULL;

ALTER TABLE api_central.tb_vehicle
    ADD CONSTRAINT fk_tb_vehicle_program_card
        FOREIGN KEY (id_program_card)
            REFERENCES api_central.tb_program_card (id_program_card)
            ON UPDATE CASCADE
            ON DELETE SET NULL;

ALTER TABLE api_central.tb_activity
    ADD CONSTRAINT fk_tb_activity_program_card
        FOREIGN KEY (id_program_card)
            REFERENCES api_central.tb_program_card (id_program_card)
            ON UPDATE CASCADE
            ON DELETE SET NULL;