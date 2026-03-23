@echo off
cd /d "%~dp0"
if not exist "auth\sessions" mkdir "auth\sessions"
start "PHP Localhost 8000" php -d session.save_path="%cd%/auth/sessions" -S localhost:8000 -t "%cd%"
echo Server started: http://localhost:8000/login.php
