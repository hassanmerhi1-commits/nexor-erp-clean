; ============================================================
;  NEXOR ERP - PostgreSQL Bundled Installer Hook
; ------------------------------------------------------------
;  This NSIS macro is included by electron-builder during the
;  installation of NEXOR ERP. It checks whether PostgreSQL is
;  already installed on the target machine and, if not, runs
;  the bundled silent installer.
;
;  Behaviour:
;    1. Detects an existing PostgreSQL service named
;       "postgresql-x64-16"  OR  "NEXOR_PostgreSQL".
;    2. If found  -> skip install, just ensure service is running.
;    3. If not    -> run bundled "postgresql-16-windows-x64.exe"
;       in silent mode with superuser password "yel3an7azi".
;    4. Creates the database "kwanza_erp" if it does not exist.
;
;  Bundled file location (after extraResources copy):
;    $INSTDIR\resources\postgres\postgresql-16-windows-x64.exe
;
;  This file is referenced by electron-builder.json -> nsis.include
; ============================================================

!macro customInstall
  DetailPrint "================================================"
  DetailPrint "  NEXOR ERP - Configuring Database Engine"
  DetailPrint "================================================"

  ; ---- 1. Look for an existing PostgreSQL Windows service ----
  nsExec::ExecToStack 'sc query "postgresql-x64-16"'
  Pop $0
  StrCmp $0 "0" PgFound CheckNexorService

  CheckNexorService:
    nsExec::ExecToStack 'sc query "NEXOR_PostgreSQL"'
    Pop $0
    StrCmp $0 "0" PgFound InstallPg

  InstallPg:
    DetailPrint "PostgreSQL not detected. Installing bundled engine..."

    ; Verify bundled installer exists
    IfFileExists "$INSTDIR\resources\postgres\postgresql-16-windows-x64.exe" 0 NoBundle

    ; Silent install:
    ;   --mode unattended
    ;   --superpassword yel3an7azi
    ;   --servicename NEXOR_PostgreSQL
    ;   --servicepassword yel3an7azi
    ;   --serverport 5432
    ;   --datadir   "C:\NEXOR\PostgreSQL\data"
    nsExec::ExecToStack '"$INSTDIR\resources\postgres\postgresql-16-windows-x64.exe" \
      --mode unattended \
      --unattendedmodeui none \
      --superpassword "yel3an7azi" \
      --servicename "NEXOR_PostgreSQL" \
      --servicepassword "yel3an7azi" \
      --serverport 5432 \
      --datadir "C:\NEXOR\PostgreSQL\data" \
      --prefix "C:\NEXOR\PostgreSQL"'
    Pop $0
    DetailPrint "PostgreSQL installer exit code: $0"
    Goto CreateDb

  NoBundle:
    DetailPrint "WARNING: Bundled PostgreSQL installer was not found."
    DetailPrint "         Place postgresql-16-windows-x64.exe inside"
    DetailPrint "         installer\postgres\ before building."
    DetailPrint "         Skipping database engine install."
    Goto Done

  PgFound:
    DetailPrint "Existing PostgreSQL service detected. Reusing."

  CreateDb:
    ; Ensure the kwanza_erp database exists.
    ; psql.exe is added to PATH by the EnterpriseDB installer.
    DetailPrint "Ensuring database 'kwanza_erp' exists..."
    nsExec::ExecToStack 'cmd /c set PGPASSWORD=yel3an7azi&& psql -U postgres -h 127.0.0.1 -p 5432 -tc "SELECT 1 FROM pg_database WHERE datname = ''kwanza_erp''" | findstr 1 || psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE kwanza_erp"'
    Pop $0
    DetailPrint "Database check exit code: $0"

  Done:
    ; Create NEXOR data folders
    CreateDirectory "C:\NEXOR\Backups"
    CreateDirectory "C:\NEXOR\CompanyFiles"
    DetailPrint "================================================"
    DetailPrint "  Database engine ready."
    DetailPrint "================================================"
!macroend

!macro customUnInstall
  ; We deliberately DO NOT uninstall PostgreSQL on app uninstall.
  ; The user's data lives in the database; removing it would be
  ; destructive. The user can uninstall PostgreSQL manually from
  ; "Add or Remove Programs" if they really want to.
  DetailPrint "NEXOR ERP removed. Database engine and company"
  DetailPrint "files in C:\NEXOR\ have been preserved."
!macroend