package com.communicator.outboxcore.service;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.communicator.outboxcore.entities.ConsumedWriteRequest;
import com.communicator.outboxcore.repositories.ConsumedWriteRequestRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConsumedWriteRequestServiceTest {

    @Mock ConsumedWriteRequestRepository repository;

    @Test
    void isDuplicate_nullRequestId_returnsFalseWithoutTouchingRepository() {
        ConsumedWriteRequestService service = new ConsumedWriteRequestService(repository);

        assertThat(service.isDuplicate(null)).isFalse();
        verify(repository, never()).existsById(ArgumentMatchers.any());
    }

    @Test
    void isDuplicate_unknownId_returnsFalse() {
        ConsumedWriteRequestService service = new ConsumedWriteRequestService(repository);
        UUID id = UUID.randomUUID();
        when(repository.existsById(id)).thenReturn(false);

        assertThat(service.isDuplicate(id)).isFalse();
    }

    @Test
    void isDuplicate_knownId_returnsTrue() {
        ConsumedWriteRequestService service = new ConsumedWriteRequestService(repository);
        UUID id = UUID.randomUUID();
        when(repository.existsById(id)).thenReturn(true);

        assertThat(service.isDuplicate(id)).isTrue();
    }

    @Test
    void markConsumed_nullRequestId_doesNotTouchRepository() {
        ConsumedWriteRequestService service = new ConsumedWriteRequestService(repository);

        service.markConsumed(null, "talkedToFriend");

        verify(repository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void markConsumed_savesRowWithRequestIdAndKind() {
        ConsumedWriteRequestService service = new ConsumedWriteRequestService(repository);
        UUID id = UUID.randomUUID();

        service.markConsumed(id, "addFriend");

        ArgumentCaptor<ConsumedWriteRequest> captor = ArgumentCaptor.forClass(ConsumedWriteRequest.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getRequestId()).isEqualTo(id);
        assertThat(captor.getValue().getKind()).isEqualTo("addFriend");
        assertThat(captor.getValue().getConsumedAt()).isNotNull();
    }
}
