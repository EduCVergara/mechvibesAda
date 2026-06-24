# Mechvibes Ada

[Leer en español](README_ES.md)

Mechvibes Ada is a new community version of Mechvibes focused on comfort, accessibility, and daily use on Windows. It keeps the classic idea of playing mechanical keyboard sounds while you type, and adds quality-of-life features for users who switch between speakers, headphones, and multiple languages.

This fork is based on the original [Mechvibes](https://github.com/hainguyents13/mechvibes) by [Hai Nguyen](https://github.com/hainguyents13). The original author is also building [MechvibesDX](https://github.com/hainguyents13/mechvibes-dx), a modern rewrite of Mechvibes.

## What's New in Mechvibes Ada

- **Latin American Spanish support:** switch between English and Spanish from the language toggle in the top-right corner.
- **Adaptive Volume:** when headphones or headset-style audio outputs are detected, Mechvibes Ada can cap its effective volume at 10 to avoid sudden loud keyboard sounds.
- **Start with Windows:** enable the app to open automatically when Windows starts.
- **Windows-friendly setup:** helper scripts are included so you can install dependencies, run the app, and build it using a local project environment.
- **Updated branding:** app name, title, tray label, installer name, and update metadata now use Mechvibes Ada.
- **Layout improvements:** the window and settings labels were adjusted so English and Spanish text fit more comfortably.

## Classic Mechvibes Features

- Play mechanical keyboard sounds while typing.
- Choose from included sound packs.
- Use random sounds for a more natural typing feel.
- Create, edit, and share custom sound packs with the Mechvibes ecosystem.
- Keep the app available in the tray while you work.

## Download

Download the latest Windows installer from the [Releases page](https://github.com/EduCVergara/mechvibesAda/releases/latest).

After installing, open Mechvibes Ada and configure:

1. Your preferred sound pack.
2. The app volume.
3. Adaptive Volume, if you switch between speakers and headphones.
4. Start with Windows, if you want the app to launch automatically.

## Build from Source on Windows

The recommended Windows flow uses the scripts included in this repository. They keep Node and npm cache local to the project as much as possible.

```powershell
.\scripts\setup.ps1
.\scripts\start.ps1
```

To build the Windows installer:

```powershell
.\scripts\build-win.ps1
```

The generated installer is created in `dist`, for example:

```text
dist\Mechvibes Ada Setup 2.4.0.exe
```

You can also use the package scripts directly if your environment is already configured:

```powershell
yarn build:win
yarn build:mac
yarn build:linux
```

If the build cannot overwrite files in `dist`, close any running copy of Mechvibes Ada or `win-unpacked` before building again.

## Check Windows Startup Registration

If you enabled **Start with Windows** and want to verify the registry entry during development, run:

```powershell
.\scripts\check-startup.ps1
```

In a packaged install, Windows should register the installed `Mechvibes Ada.exe`. In development, the app may register Electron with the project path.

## Support

If Mechvibes Ada helps you, you can support the maintainer:

- [Buy EduCVergara a Coffee](https://ko-fi.com/azhem)

You can also support the original creator:

- [Buy Hai Nguyen a Coffee](https://buymeacoff.ee/hainguyents13)

## Credits

- Original Mechvibes: [Hai Nguyen](https://github.com/hainguyents13)
- Mechvibes Ada fork and Spanish support: [EduCVergara](https://github.com/EduCVergara)
- Community sound packs, testing, ideas, and contributions: the Mechvibes community

## License

Mechvibes Ada follows the original project's MIT license.
