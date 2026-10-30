-- E53: an outbox event the reporting worker cannot apply because its data is
-- bad (missing merchantId, constraint violation) is parked here instead of
-- blocking every later event forever. Kept for a human to inspect/replay.
CREATE TABLE reporting_dead_letters (
    outbox_event_id BIGINT NOT NULL,
    consumer_name   TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    error           TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (consumer_name, outbox_event_id)
);
