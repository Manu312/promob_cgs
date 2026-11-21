# Promob Plus ARG — inventario técnico (referencia)

Resumen escrito por nosotros a partir de **metadatos** de la instalación (nombres de carpetas/archivos, cabeceras PE/CLI)
y del uso normal del programa. **No se descompiló código, no se copió ningún archivo de Promob y nada de Promob va a este repo.**
La licencia de Promob muy probablemente prohíbe descompilarlo; para construir nuestra app no hace falta.

## Instalación observada

| Dato | Valor |
|---|---|
| Producto | Promob Plus ARG 1.0.0.6 (Promob Software Solutions) + Promob Downloader 10.26.0.0 |
| Ubicación | `C:\Program Files\Promob\Promob Plus ARG` |
| Tamaño | ~74.000 archivos, 4,3 GB (mayoría: texturas JPG y bibliotecas de módulos) |
| Ejecutable principal | `Program\Bin\Promob5.exe` 5.60.48.4 |
| Plataforma | **.NET Framework 4.8**, IL-only, AnyCPU (REA `inspect_managed_artifact`) |
| Ensamblados | 792 ensamblados .NET detectados por REA en toda la instalación (`inspect_desktop_application`) |

## Arquitectura (según nombres de librerías)

- Interfaz WPF con controles comerciales Telerik.
- Vista 3D con OpenGL (`ProCAD.OpenGL`, `Tao.OpenGl`).
- Render propio por trazado de rayos (`ProMOB.RayTracerViewApplication`, `ExternalRenderer`) sobre **Intel Embree** (libre).
- Módulo de presupuesto propio (`Promob.Budget*`), base local **SQLite**.
- Sistema de plugins/add-ins.
- Plan de corte: no aparece en la edición Plus (Promob lo ofrece en Enterprise).

## Formatos de datos (a alto nivel)

- Bibliotecas, estructuras, geometría y placares: **XML** (`.group`, `.structures`, `.geometry`, `.wardrobe`).
- Entidades/materiales: formato serializado propio (`.entity`, `.material`).
- Modelos 3D (`.MOB3D`) y proyectos (`.PMOB`): binarios propios.

## Qué tomamos como referencia (funcional, no código)

- Qué funciones usa una mueblería: diseño de ambiente, módulos paramétricos, render, presupuesto, corte.
- Que el corazón del sistema es un **motor de módulos paramétricos** → lo implementamos con reglas propias (`src/domain/modules.js`).
- Que el render fotorrealista se resuelve con trazado de rayos → usamos `three-gpu-pathtracer` en el navegador.

## Cómo repetir el inventario con REA

En Claude Code con REA conectado (ver `ENTORNO.md`):

- `inspect_desktop_application` con `path = C:\Program Files\Promob\Promob Plus ARG` → tecnologías y candidatos.
- `inspect_managed_artifact` con `path = ...\Program\Bin\Promob5.exe` → framework, versión y arquitectura.

Ambas herramientas solo leen metadatos: no cargan ni ejecutan el programa.
