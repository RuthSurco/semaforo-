@echo off
title Semaforo+ - Backend Spring Boot
cd /d "%~dp0"

echo ================================================
echo   Semaforo+ - Iniciando backend Spring Boot
echo ================================================
echo.

where java >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro Java. Instala Java 21 o superior.
    pause
    exit /b 1
)

if exist "target\semaforo-plus-1.0.0.jar" (
    echo Usando el JAR compilado...
    java -jar "target\semaforo-plus-1.0.0.jar"
) else (
    echo No hay JAR compilado. Compilando y ejecutando con Maven...
    call mvn spring-boot:run
)

echo.
echo El servidor se detuvo.
pause
