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
import static org.mockito.Mockito.lenient;

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

    // (a) Executor obtém sua lista (e somente os seus)
    @Test
    void executorObtendoSeusPropriosCartoes() {
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

    // (b) Gestor consegue obter a lista de um dado executor
    @Test
    void gestorPodeAcessarQualquerExecutor() {
        UserDTO principal = new UserDTO();
        principal.setManager(true); // isManager = true
        principal.setId(UUID.randomUUID().toString());

        Authentication auth = authWithPrincipal(principal, principal.getId());

        UUID outroExecutor = UUID.randomUUID();
        when(repository.findByUserAssigned_Id(eq(outroExecutor), any(Pageable.class)))
                .thenReturn(Page.empty());

        assertDoesNotThrow(() -> service.listarPorExecutor(outroExecutor, pageable, auth));
        verify(repository, times(1)).findByUserAssigned_Id(eq(outroExecutor), any(Pageable.class));
    }

    // (c) Executor tentando acessar dados de outro -> 403
    @Test
    void executorAcessandoOutroExecutorDeveDar403() {
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

    // (d) Sem cartões para um executor -> retorna apropriadamente (aqui: lista vazia/200)
    @Test
    void retornoVazioQuandoSemCartoesParaExecutor() {
        UUID executor = UUID.randomUUID();

        UserDTO principal = new UserDTO();
        principal.setManager(false);
        principal.setId(executor.toString());

        Authentication auth = authWithPrincipal(principal, principal.getId());

        when(repository.findByUserAssigned_Id(eq(executor), any(Pageable.class)))
                .thenReturn(Page.empty());

        Page<?> page = service.listarPorExecutor(executor, pageable, auth);

        assertNotNull(page);
        assertTrue(page.isEmpty());
        assertEquals(0, page.getTotalElements());

        verify(repository, times(1)).findByUserAssigned_Id(eq(executor), any(Pageable.class));
    }
}