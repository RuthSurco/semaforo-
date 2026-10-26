package com.semaforoplus.repositorio;

import com.semaforoplus.modelo.Rol;
import com.semaforoplus.modelo.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByUsuarioIgnoreCase(String usuario);

    boolean existsByUsuarioIgnoreCase(String usuario);

    boolean existsByUsuarioIgnoreCaseAndIdNot(String usuario, Long id);

    long countByRolAndActivoTrue(Rol rol);

    List<Usuario> findAllByOrderByIdAsc();
}
