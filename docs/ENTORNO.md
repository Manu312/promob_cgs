# Preparar una PC nueva

## Para desarrollar la app (lo único imprescindible)

1. **Node.js 20+** (se usa 24) — https://nodejs.org
2. **Git** — `winget install --id Git.Git -e`
3. Clonar e instalar:
   ```powershell
   git clone https://github.com/Manu312/promob_cgs.git
   cd promob_cgs
   npm install
   npm run dev
   ```
4. Para el e2e: Google Chrome instalado (o `CHROME_PATH` apuntando al ejecutable).

## Herramientas de análisis (opcionales)

Solo para inspeccionar binarios con REA. No son necesarias para desarrollar la app.

| Herramienta | Versión usada | Instalación |
|---|---|---|
| Eclipse Temurin JDK | 25.0.5.1 LTS (Ghidra 12.2 exige Java 25+) | `winget install --id EclipseAdoptium.Temurin.25.JDK -e` |
| Ghidra (NSA, Apache 2.0) | 12.2 (`ghidra_12.2_PUBLIC_20261016.zip`) | Descargar de https://github.com/NationalSecurityAgency/ghidra/releases, verificar SHA-256 `2c2cd776db3c1f6a097ba418922378ac3649cadd5e844a6f5f088ae628a7be67`, descomprimir en `C:\Tools\` |
| REA (Reverse Engineer Anything) | 6.10.1 | `npm install --global rea-agents` y luego `rea setup --client claude_code --client antigravity --yes` |

Variables de entorno de usuario:

```powershell
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-25.0.5.10002-hotspot', 'User')
[Environment]::SetEnvironmentVariable('GHIDRA_INSTALL_DIR', 'C:\Tools\ghidra_12.2_PUBLIC', 'User')
```

Verificación:

- `rea --version` → 6.10.1
- `rea setup --client claude_code --client antigravity --dry-run` muestra el plan sin aplicarlo.
- Ghidra headless: `C:\Tools\ghidra_12.2_PUBLIC\support\analyzeHeadless.bat <carpeta> Test -import C:\Windows\System32\notepad.exe -deleteProject`.
- Reiniciar Claude Code / Antigravity: `/mcp` debe mostrar `rea` conectado.

REA queda registrado en `~/.claude.json` (Claude Code) y `~/.gemini/config/mcp_config.json` (Antigravity), con la skill en `~/.claude/skills/reverse-engineer-anything` y `~/.gemini/config/skills/reverse-engineer-anything`.

Motores opcionales no configurados: IDA, Kuna, JADX (Android). Frida quedó con su script de instalación bloqueado por npm (solo hace falta para instrumentar procesos en ejecución).
