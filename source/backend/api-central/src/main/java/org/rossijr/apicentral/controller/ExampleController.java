package org.rossijr.apicentral.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.rossijr.apicentral.dto.UserDTO;
import org.rossijr.apicentral.service.ExampleService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/v1/example")
@Tag(name = "Example", description = "Example controller for demonstration purposes - Use this base to create further controllers")
@AllArgsConstructor
public class ExampleController {

    private final ExampleService service;

    @GetMapping("/users")
    public ResponseEntity<List<UserDTO>> getAllUsers() {
        return ResponseEntity.ok(service.findAllUsers());
    }

    @PostMapping("/users")
    public ResponseEntity<UserDTO> createUser(@Valid @RequestBody UserDTO user) {
        UserDTO createdUser = service.createUser(user);
        return ResponseEntity.created(URI.create(String.format("/v1/example/users/%s", createdUser.getId())))
                .body(createdUser);
    }
}
