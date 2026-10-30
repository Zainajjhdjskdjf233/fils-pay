-- E136: an archive could be replayed again and again (each run queues every
-- archived delivery once more). It may now be replayed once: the replay sets
-- replayed_at with UPDATE ... WHERE replayed_at IS NULL, so a second call (or
-- two at the same moment) finds no row and gets 409.
ALTER TABLE webhook_delivery_archives ADD COLUMN replayed_at TIMESTAMPTZ;
