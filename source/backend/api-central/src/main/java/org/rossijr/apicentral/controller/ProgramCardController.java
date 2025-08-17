package org.rossijr.apicentral.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import org.rossijr.apicentral.dto.ProgramCardResumoDTO;
import org.rossijr.apicentral.service.ProgramCardService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/v1/cartao-programa")
@Tag(name = "Cartão-Programa", description = "Funcionalidades gerais do cartão-programa")
@AllArgsConstructor
public class ProgramCardController {

    private final ProgramCardService programCardService;

    @GetMapping("/{executorId}/visualizacao")
    public ResponseEntity<Page<ProgramCardResumoDTO>> listarCartoes(
            @PathVariable UUID executorId,
            Pageable pageable,
            Authentication auth
    ) {
        return ResponseEntity.ok(programCardService.listarPorExecutor(executorId, pageable, auth));
    }
}