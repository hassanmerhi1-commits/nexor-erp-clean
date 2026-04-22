# Bundled PostgreSQL Installer

Drop the official PostgreSQL 16 Windows installer in this folder
**before** running `build-installer.bat`.

## File required

```
installer/postgres/postgresql-16-windows-x64.exe
```

## Where to download it

EnterpriseDB official builds:
<https://www.enterprisedb.com/downloads/postgres-postgresql-downloads>

Pick **PostgreSQL 16.x — Windows x86-64**.
File size: ~330 MB. Rename the downloaded file exactly to
`postgresql-16-windows-x64.exe`.

## What happens during NEXOR ERP install

The NSIS hook (`installer/install-postgres.nsh`) runs at install time:

1. Detects an existing PostgreSQL 16 service.
   - If found → reuse it.
   - If not   → silently install the bundled binary.
2. Service registered as **NEXOR_PostgreSQL**, port 5432,
   superuser password **yel3an7azi**, data dir
   `C:\NEXOR\PostgreSQL\data`.
3. Database **kwanza_erp** is created automatically if missing.
4. NEXOR data folders created:
   - `C:\NEXOR\Backups\`        — daily auto-backups
   - `C:\NEXOR\CompanyFiles\`   — `.nexor` exports/imports

## Why not include the binary in Git

330 MB binary blobs do not belong in source control. The
`build-installer.bat` script will warn you if the file is missing.

## .gitignore

The actual installer binary is git-ignored. Only this README is
tracked.