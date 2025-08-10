package org.rossijr.apicentral.service;


import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.rossijr.apicentral.dto.UserDTO;
import org.rossijr.apicentral.entity.User;
import org.rossijr.apicentral.mapper.UserMapper;
import org.rossijr.apicentral.repository.ExampleRepository;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

class ExampleServiceTest {

    @Mock
    private ExampleRepository exampleRepository;

    @InjectMocks
    private ExampleService exampleService;

    @Mock
    private UserMapper userMapper = Mappers.getMapper(UserMapper.class);


    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testFindAllUsers() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setName("Test User");

        UserDTO userDTO = new UserDTO();
        userDTO.setId(user.getId().toString());
        userDTO.setName(user.getName());

        when(exampleRepository.findAllUsers()).thenReturn(List.of(user));
        when(userMapper.toDto(user)).thenReturn(userDTO);

        List<UserDTO> result = exampleService.findAllUsers();

        assertEquals(1L, result.size());
        assertEquals("Test User", result.getFirst().getName());
    }
}
