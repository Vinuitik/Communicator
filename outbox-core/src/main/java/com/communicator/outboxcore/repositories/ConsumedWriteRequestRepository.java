package com.communicator.outboxcore.repositories;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.communicator.outboxcore.entities.ConsumedWriteRequest;

@Repository
public interface ConsumedWriteRequestRepository extends JpaRepository<ConsumedWriteRequest, UUID> {
}
