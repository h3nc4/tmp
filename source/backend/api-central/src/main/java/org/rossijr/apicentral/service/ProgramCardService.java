package org.rossijr.apicentral.service;

import org.rossijr.apicentral.dto.ProgramCardResumoDTO;
import org.rossijr.apicentral.dto.UserDTO;
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

    /**
     * Regra:
     *  - Se for manager (isManager == true) -> pode ver qualquer executor.
     *  - Caso contrário -> só pode ver se o principal == executor solicitado.
     */
    private boolean podeVerExecutor(UUID requestedExecutorId, Authentication auth) {
        if (auth == null) return false;


        if (isManager(auth)) return true;


        try {
            UUID principalId = UUID.fromString(auth.getName());
            return principalId.equals(requestedExecutorId);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Detecta se o usuário autenticado é manager com base no campo booleano isManager.
     * Se o principal for UserDTO, usa diretamente. Caso contrário, tenta via reflexão
     * métodos isManager() / getIsManager().
     */
    private boolean isManager(Authentication auth) {
        Object principal = auth.getPrincipal();
        if (principal == null) return false;

        if (principal instanceof UserDTO dto) {
            return dto.isManager();
        }

        try {
            var m = principal.getClass().getMethod("isManager");
            var v = m.invoke(principal);
            if (v instanceof Boolean b) return b;
        } catch (Exception ignored) { }

        try {
            var m = principal.getClass().getMethod("getIsManager");
            var v = m.invoke(principal);
            if (v instanceof Boolean b) return b;
        } catch (Exception ignored) { }

        return false;
    }
}