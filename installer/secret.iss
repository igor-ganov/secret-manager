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

[Messages]
FinishedLabel=Setup has finished installing [name] on your computer.%n%nThe folder was added to your PATH. Open a NEW terminal window (or restart your IDE) and run:  secret login

[Files]
Source: "..\dist\secret.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Secret manager console"; Filename: "{app}\secret.exe"
Name: "{group}\Uninstall Secret manager CLI"; Filename: "{uninstallexe}"

[Code]
const
  EnvironmentKey = 'Environment';

{ The user's PATH as a list without empty entries, so a trailing ';' left
  by other installers never turns into ';;'. }
function ReadUserPath: string;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Result) then
    Result := '';
end;

function ContainsFolder(PathValue, Folder: string): boolean;
begin
  Result := Pos(';' + Lowercase(Folder) + ';', ';' + Lowercase(PathValue) + ';') > 0;
end;

function TrimSeparators(Value: string): string;
begin
  Result := Value;
  while (Length(Result) > 0) and (Result[1] = ';') do
    Delete(Result, 1, 1);
  while (Length(Result) > 0) and (Result[Length(Result)] = ';') do
    Delete(Result, Length(Result), 1);
end;

procedure AddToPath(Folder: string);
var
  Current: string;
begin
  Current := TrimSeparators(ReadUserPath);
  if ContainsFolder(Current, Folder) then
    exit;
  if Current = '' then
    Current := Folder
  else
    Current := Current + ';' + Folder;
  RegWriteExpandStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Current);
end;

procedure RemoveFromPath(Folder: string);
var
  Current: string;
  P: Integer;
begin
  Current := ReadUserPath;
  P := Pos(';' + Lowercase(Folder) + ';', ';' + Lowercase(Current) + ';');
  if P = 0 then
    exit;
  { P counts the ';' that was prepended; delete the entry and one separator. }
  Delete(Current, P, Length(Folder) + 1);
  RegWriteExpandStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', TrimSeparators(Current));
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    AddToPath(ExpandConstant('{app}'));
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    RemoveFromPath(ExpandConstant('{app}'));
end;
