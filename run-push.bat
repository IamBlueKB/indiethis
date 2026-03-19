@echo off
cd /d C:\Users\brian\Documents\indiethis
npx prisma db push
echo EXIT_CODE=%ERRORLEVEL%
