# Mechvibes Ada

[Read in English](README.md)

Mechvibes Ada es una nueva versión comunitaria de Mechvibes enfocada en comodidad, accesibilidad y uso diario en Windows. Mantiene la idea clásica de reproducir sonidos de teclado mecánico mientras escribes, y agrega mejoras pensadas para quienes alternan entre parlantes, audífonos y más de un idioma.

Este fork está basado en el [Mechvibes](https://github.com/hainguyents13/mechvibes) original de [Hai Nguyen](https://github.com/hainguyents13). El autor original también está desarrollando [MechvibesDX](https://github.com/hainguyents13/mechvibes-dx), una reescritura moderna de Mechvibes.

## Novedades de Mechvibes Ada

- **Soporte para español latinoamericano:** cambia entre inglés y español desde el selector de idioma en la esquina superior derecha.
- **Volumen adaptativo:** cuando detecta audífonos o salidas de audio tipo headset, Mechvibes Ada puede limitar su volumen efectivo a 10 para evitar sonidos repentinos demasiado fuertes.
- **Inicio con Windows:** permite abrir la aplicación automáticamente cuando inicia Windows.
- **Configuración amigable para Windows:** incluye scripts para instalar dependencias, ejecutar la app y compilarla usando un entorno local del proyecto.
- **Marca actualizada:** el nombre de la app, título, bandeja, instalador y metadatos de actualización ahora usan Mechvibes Ada.
- **Mejoras de interfaz:** la ventana y los textos de configuración se ajustaron para que el contenido en inglés y español tenga mejor espacio.

## Funciones clásicas de Mechvibes

- Reproduce sonidos de teclado mecánico mientras escribes.
- Permite elegir entre paquetes de sonido incluidos.
- Usa sonidos aleatorios para una experiencia de escritura más natural.
- Permite crear, editar y compartir paquetes de sonido personalizados con el ecosistema de Mechvibes.
- Mantiene la aplicación disponible desde la bandeja del sistema mientras trabajas.

## Descargar

Descarga el instalador más reciente para Windows desde la [página de Releases](https://github.com/EduCVergara/mechvibesAda/releases/latest).

Después de instalar, abre Mechvibes Ada y configura:

1. Tu paquete de sonido preferido.
2. El volumen de la app.
3. Volumen adaptativo, si alternas entre parlantes y audífonos.
4. Inicio con Windows, si quieres que la app se abra automáticamente.

## Compilar desde el código fuente en Windows

El flujo recomendado en Windows usa los scripts incluidos en este repositorio. Estos mantienen Node y la caché de npm lo más local posible al proyecto.

```powershell
.\scripts\setup.ps1
.\scripts\start.ps1
```

Para crear el instalador de Windows:

```powershell
.\scripts\build-win.ps1
```

El instalador generado queda en `dist`, por ejemplo:

```text
dist\Mechvibes Ada Setup 2.4.0.exe
```

También puedes usar directamente los scripts del paquete si tu entorno ya está configurado:

```powershell
yarn build:win
yarn build:mac
yarn build:linux
```

Si la compilación no puede sobrescribir archivos en `dist`, cierra cualquier copia abierta de Mechvibes Ada o de `win-unpacked` antes de volver a compilar.

## Revisar el registro de inicio con Windows

Si activaste **Inicio con Windows** y quieres verificar la entrada del registro durante el desarrollo, ejecuta:

```powershell
.\scripts\check-startup.ps1
```

En una instalación empaquetada, Windows debería registrar el `Mechvibes Ada.exe` instalado. En desarrollo, la app puede registrar Electron junto a la ruta del proyecto.

## Apoyar

Si Mechvibes Ada te sirve, puedes apoyar al mantenedor:

- [Invita un café a EduCVergara](https://ko-fi.com/azhem)

También puedes apoyar al creador original:

- [Invita un café a Hai Nguyen](https://buymeacoff.ee/hainguyents13)

## Créditos

- Mechvibes original: [Hai Nguyen](https://github.com/hainguyents13)
- Fork Mechvibes Ada y soporte en español: [EduCVergara](https://github.com/EduCVergara)
- Paquetes de sonido, pruebas, ideas y contribuciones: la comunidad de Mechvibes

## Licencia

Mechvibes Ada mantiene la licencia MIT del proyecto original.
