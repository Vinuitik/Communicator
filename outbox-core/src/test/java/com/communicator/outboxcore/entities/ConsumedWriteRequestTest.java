package com.communicator.outboxcore.entities;

import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins down the exact mechanism the concurrent-duplicate-write fix depends on:
 * isNew() must always return true so Spring Data's save() always does an INSERT,
 * never a merge/upsert (its default for an entity with a manually-assigned @Id
 * and no @Version). A regression here would silently bring back the race where
 * two concurrent duplicate writes both succeed instead of the second one throwing.
 */
class ConsumedWriteRequestTest {

    @Test
    void isNew_alwaysTrue_regardlessOfWhetherIdIsSet() {
        ConsumedWriteRequest withId = new ConsumedWriteRequest(UUID.randomUUID(), "talkedToFriend", LocalDateTime.now());
        ConsumedWriteRequest withoutId = new ConsumedWriteRequest();

        assertThat(withId.isNew()).isTrue();
        assertThat(withoutId.isNew()).isTrue();
    }

    @Test
    void getId_returnsRequestId() {
        UUID id = UUID.randomUUID();
        ConsumedWriteRequest request = new ConsumedWriteRequest(id, "addFriend", LocalDateTime.now());

        assertThat(request.getId()).isEqualTo(id);
    }
}
