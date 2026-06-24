@echo off
title CV Builder (Next.js)
echo ==========================================
echo Démarrage de l'application CV Builder...
echo ==========================================
echo.

cd web

:: Ouvre le navigateur par défaut
start http://localhost:3000

:: Lance le serveur Next.js (cette commande bloque la fenêtre pour garder le serveur actif)
call npm run dev

pause
