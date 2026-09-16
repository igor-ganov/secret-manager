; Inno Setup script for the console utility. Per-user install (no admin
; prompt), adds the folder to the user's PATH so `secret` works in any new
; terminal, and registers an uninstaller. Built by scripts/build-installer.ts.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{7A4C1F2E-5B6D-4E8F-9A0B-3C2D1E0F9A8B}
AppName=Secret manager CLI
AppVersion={#AppVersion}
AppPublisher=secret-manager
AppPublisherURL=https://github.com/igor-ganov/secret-manager
DefaultDirName={localappdata}\Programs\secret-manager
DefaultGroupName=Secret manager
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=secret-setup
Compression=lzma2
SolidCompression=yes
ChangesEnvironment=yes
UninstallDisplayName=Secret manager CLI
WizardStyle=modern
DisableProgramGroupPage=yes

[Files]
Source: "..\dist\secret.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Secret manager console"; Filename: "{app}\secret.exe"
Name: "{group}\Uninstall Secret manager CLI"; Filename: "{uninstallexe}"

[Registry]
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Check: NeedsAddPath(ExpandConstant('{app}'))

[Code]
{ True when the folder is not yet on the user's PATH (case-insensitive). }
function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath) then
  begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Lowercase(Param) + ';', ';' + Lowercase(OrigPath) + ';') = 0;
end;

{ Removes the folder from the user's PATH again when uninstalling. }
procedure RemoveFromPath(Folder: string);
var
  OrigPath, Lowered: string;
  P: Integer;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath) then
    exit;
  Lowered := ';' + Lowercase(OrigPath) + ';';
  P := Pos(';' + Lowercase(Folder) + ';', Lowered);
  if P = 0 then
    exit;
  Delete(OrigPath, P, Length(Folder) + 1);
  if (Length(OrigPath) > 0) and (OrigPath[1] = ';') then
    Delete(OrigPath, 1, 1);
  if (Length(OrigPath) > 0) and (OrigPath[Length(OrigPath)] = ';') then
    Delete(OrigPath, Length(OrigPath), 1);
  RegWriteExpandStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    RemoveFromPath(ExpandConstant('{app}'));
end;
