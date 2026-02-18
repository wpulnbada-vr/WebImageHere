; WebHere Custom NSIS Installer Script
!include "LogicLib.nsh"

!macro customHeader
  !include "LogicLib.nsh"
!macroend

!macro customInit
  ; Check for running instances before install
  FindWindow $0 "" "WebHere"
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION|MB_OK "Please close WebHere before installing."
    Abort
  ${EndIf}
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to WebHere"
  !define MUI_WELCOMEPAGE_TEXT "WebHere helps you organize and archive publicly available images from the web.$\r$\n$\r$\nFeatures:$\r$\n  - Batch image archiving from any URL$\r$\n  - Smart page navigation and lazy-load detection$\r$\n  - Built-in file manager with search and sharing$\r$\n  - Real-time progress monitoring$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnInstall
  ; Remove app data (history, auth config, monitor config)
  RMDir /r "$APPDATA\WebHere"
  ; Remove local app data if exists
  RMDir /r "$LOCALAPPDATA\WebHere"
!macroend

!macro customRemoveFiles
  ; Remove any log files
  RMDir /r "$INSTDIR\logs"
!macroend
