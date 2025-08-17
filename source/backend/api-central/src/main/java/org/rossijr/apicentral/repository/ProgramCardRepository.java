package org.rossijr.apicentral.repository;

import org.rossijr.apicentral.entity.ProgramCard;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProgramCardRepository extends JpaRepository<ProgramCard, UUID> {
    Page<ProgramCard> findByUserAssigned_Id(UUID executorId, Pageable pageable);
}