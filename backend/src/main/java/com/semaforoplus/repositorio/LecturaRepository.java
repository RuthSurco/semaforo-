package com.semaforoplus.repositorio;

import com.semaforoplus.modelo.Lectura;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface LecturaRepository extends JpaRepository<Lectura, Long> {

    List<Lectura> findByMomentoAfterOrderByMomentoAsc(LocalDateTime desde);

    List<Lectura> findByMomentoBetweenOrderByMomentoAsc(LocalDateTime desde, LocalDateTime hasta);

    List<Lectura> findTop100ByOrderByMomentoDesc();

    List<Lectura> findTop1000ByOrderByMomentoAsc();

    @Transactional
    @Modifying
    long deleteByMomentoBefore(LocalDateTime limite);

    @Transactional
    @Modifying
    @Query("delete from Lectura l where l.id in :ids")
    int eliminarPorIds(@Param("ids") List<Long> ids);
}
