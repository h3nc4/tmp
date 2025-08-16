package org.rossijr.apicentral.service;

import org.rossijr.apicentral.dto.ProgramCardResumoDTO;
import org.rossijr.apicentral.repository.ProgramCardRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ProgramCardService {
    private final ProgramCardRepository repository;

    public ProgramCardService(ProgramCardRepository repository) {
        this.repository = repository;
    }

    public Page<ProgramCardResumoDTO> listarPorExecutor(UUID executorId, Pageable pageable, Authentication auth) {
        if (!podeVerExecutor(executorId, auth)) throw new AccessDeniedException("forbidden");
        return repository.findByUserAssigned_Id(executorId, pageable)
                .map(p -> new ProgramCardResumoDTO(
                        p.getId(),
                        p.getTitle(),
                        p.getSector(),
                        p.getCriminalFocus(),
                        p.getShiftStart(),
                        p.getShiftEnd(),
                        p.isActive()
                ));
    }

    private boolean podeVerExecutor(UUID requested, Authentication auth) {
        if (auth == null) return false;
        var isGestor = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_GESTOR"));
        if (isGestor) return true;
        var isExecutor = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_EXECUTOR"));
        if (!isExecutor) return false;
        try {
            var principalId = UUID.fromString(auth.getName());
            return principalId.equals(requested);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}