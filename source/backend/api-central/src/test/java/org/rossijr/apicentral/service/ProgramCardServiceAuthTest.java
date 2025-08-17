package org.rossijr.apicentral.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.rossijr.apicentral.dto.UserDTO;
import org.rossijr.apicentral.repository.ProgramCardRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProgramCardServiceAuthTest {

    @Mock
    private ProgramCardRepository repository;

    @InjectMocks
    private ProgramCardService service;

    private Pageable pageable;

    @BeforeEach
    void setUp() {
        pageable = Pageable.unpaged();
    }

    private static Authentication authWithPrincipal(UserDTO dto, String nameAsUuid) {
        Authentication auth = mock(Authentication.class);
        lenient().when(auth.getPrincipal()).thenReturn(dto);
        lenient().when(auth.getName()).thenReturn(nameAsUuid);
        return auth;
    }

    @Test
    void managerPodeVerQualquerExecutor() {

        UserDTO principal = new UserDTO();
        principal.setManager(true);
        principal.setId(UUID.randomUUID().toString());

        Authentication auth = authWithPrincipal(principal, principal.getId());

        UUID outroExecutor = UUID.randomUUID();
        when(repository.findByUserAssigned_Id(eq(outroExecutor), any(Pageable.class)))
                .thenReturn(Page.empty());

        assertDoesNotThrow(() -> service.listarPorExecutor(outroExecutor, pageable, auth));
        verify(repository, times(1)).findByUserAssigned_Id(eq(outroExecutor), any(Pageable.class));
    }

    @Test
    void naoManagerPodeVerSomenteSeForEleMesmo() {
        UUID executor = UUID.randomUUID();

        UserDTO principal = new UserDTO();
        principal.setManager(false);
        principal.setId(executor.toString());

        Authentication auth = authWithPrincipal(principal, principal.getId());

        when(repository.findByUserAssigned_Id(eq(executor), any(Pageable.class)))
                .thenReturn(Page.empty());

        assertDoesNotThrow(() -> service.listarPorExecutor(executor, pageable, auth));
        verify(repository, times(1)).findByUserAssigned_Id(eq(executor), any(Pageable.class));
    }

    @Test
    void naoManagerAcessandoOutroExecutorDeveLancar403() {
        UUID executorSolicitado = UUID.randomUUID();
        UUID principalId = UUID.randomUUID();

        UserDTO principal = new UserDTO();
        principal.setManager(false);
        principal.setId(principalId.toString());

        Authentication auth = authWithPrincipal(principal, principal.getId());

        assertThrows(AccessDeniedException.class,
                () -> service.listarPorExecutor(executorSolicitado, pageable, auth));

        verify(repository, never()).findByUserAssigned_Id(any(UUID.class), any(Pageable.class));
    }
}