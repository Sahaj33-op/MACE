//go:build windows

package launcher

import (
	"context"
	_ "embed"
	"fmt"
	"syscall"
	"unsafe"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/windows"
)

//go:embed icon.ico
var iconIcoBytes []byte

var (
	user32               = windows.NewLazySystemDLL("user32.dll")
	shell32              = windows.NewLazySystemDLL("shell32.dll")
	pRegisterClassEx     = user32.NewProc("RegisterClassExW")
	pCreateWindowEx      = user32.NewProc("CreateWindowExW")
	pDefWindowProc       = user32.NewProc("DefWindowProcW")
	pDestroyWindow       = user32.NewProc("DestroyWindow")
	pGetMessage          = user32.NewProc("GetMessageW")
	pTranslateMessage    = user32.NewProc("TranslateMessage")
	pDispatchMessage     = user32.NewProc("DispatchMessageW")
	pPostQuitMessage     = user32.NewProc("PostQuitMessage")
	pShellNotifyIcon     = shell32.NewProc("Shell_NotifyIconW")
	pCreatePopupMenu     = user32.NewProc("CreatePopupMenu")
	pAppendMenu          = user32.NewProc("AppendMenuW")
	pTrackPopupMenu      = user32.NewProc("TrackPopupMenu")
	pGetCursorPos        = user32.NewProc("GetCursorPos")
	pSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	pLoadIcon            = user32.NewProc("LoadIconW")
	k32                  = windows.NewLazySystemDLL("kernel32.dll")
	pGetModuleHandle     = k32.NewProc("GetModuleHandleW")
)

const (
	WM_DESTROY       = 0x0002
	WM_COMMAND       = 0x0111
	WM_USER          = 0x0400
	WM_TRAY_MSG      = WM_USER + 1
	NIM_ADD          = 0x00000000
	NIM_DELETE       = 0x00000002
	NIF_MESSAGE      = 0x00000001
	NIF_ICON         = 0x00000002
	NIF_TIP          = 0x00000004
	WM_LBUTTONUP     = 0x0202
	WM_LBUTTONDBLCLK = 0x0203
	WM_RBUTTONUP     = 0x0205
	MF_STRING        = 0x00000000
	MF_SEPARATOR     = 0x00000800
	TPM_LEFTALIGN    = 0x0000
	TPM_RIGHTBUTTON  = 0x0002
	ID_SHOW          = 1001
	ID_EXIT          = 1002
)

type NOTIFYICONDATAW struct {
	CbSize            uint32
	HWnd              windows.Handle
	UID               uint32
	UFlags            uint32
	UCallbackMessage  uint32
	HIcon             windows.Handle
	SzTip             [128]uint16
	DwState           uint32
	DwStateMask       uint32
	SzInfo            [256]uint16
	UTimeoutOrVersion uint32
	SzInfoTitle       [64]uint16
	DwInfoFlags       uint32
	GuidItem          windows.GUID
	HBalloonIcon      windows.Handle
}

type WNDCLASSEXW struct {
	Size       uint32
	Style      uint32
	WndProc    uintptr
	ClsExtra   int32
	WndExtra   int32
	Instance   windows.Handle
	Icon       windows.Handle
	Cursor     windows.Handle
	Background windows.Handle
	MenuName   *uint16
	ClassName  *uint16
	IconSm     windows.Handle
}

var trayHWnd windows.Handle
var trayNID NOTIFYICONDATAW
var wailsCtx context.Context

// SetupTray registers the system tray icon for Windows.
func SetupTray(ctx context.Context) {
	wailsCtx = ctx
	go runTrayMessageLoop()
}

// RemoveTray deletes the system tray icon and window.
func RemoveTray() {
	if trayHWnd != 0 {
		pShellNotifyIcon.Call(uintptr(NIM_DELETE), uintptr(unsafe.Pointer(&trayNID)))
		pDestroyWindow.Call(uintptr(trayHWnd))
	}
}

func runTrayMessageLoop() {
	className, _ := windows.UTF16PtrFromString("MACETrayWindowClass")
	windowName, _ := windows.UTF16PtrFromString("MACETrayWindow")

	wc := WNDCLASSEXW{
		Size:      uint32(unsafe.Sizeof(WNDCLASSEXW{})),
		WndProc:   syscall.NewCallback(wndProc),
		ClassName: className,
	}

	pRegisterClassEx.Call(uintptr(unsafe.Pointer(&wc)))

	hwnd, _, _ := pCreateWindowEx.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(windowName)),
		0,
		0, 0, 0, 0,
		0, 0, 0, 0,
	)

	if hwnd == 0 {
		return
	}

	trayHWnd = windows.Handle(hwnd)

	// Load MACE icon from embedded bytes
	hIcon, err := getIconFromICO(iconIcoBytes)
	if err != nil || hIcon == 0 {
		// Fallback to standard system application icon
		hIconVal, _, _ := pLoadIcon.Call(0, uintptr(32512)) // IDI_APPLICATION
		hIcon = windows.Handle(hIconVal)
	}

	trayNID = NOTIFYICONDATAW{
		HWnd:             trayHWnd,
		UID:              1,
		UFlags:           NIF_MESSAGE | NIF_ICON | NIF_TIP,
		UCallbackMessage: WM_TRAY_MSG,
		HIcon:            hIcon,
	}
	trayNID.CbSize = uint32(unsafe.Sizeof(trayNID))
	copy(trayNID.SzTip[:], windows.StringToUTF16("MACE - Minecraft Advanced Control Engine"))

	pShellNotifyIcon.Call(uintptr(NIM_ADD), uintptr(unsafe.Pointer(&trayNID)))

	var msg struct {
		HWnd    windows.Handle
		Message uint32
		WParam  uintptr
		LParam  uintptr
		Time    uint32
		Pt      struct{ X, Y int32 }
	}

	for {
		ret, _, _ := pGetMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(ret) <= 0 {
			break
		}
		pTranslateMessage.Call(uintptr(unsafe.Pointer(&msg)))
		pDispatchMessage.Call(uintptr(unsafe.Pointer(&msg)))
	}
}

func wndProc(hwnd windows.Handle, msg uint32, wParam uintptr, lParam uintptr) uintptr {
	switch msg {
	case WM_TRAY_MSG:
		switch lParam {
		case WM_LBUTTONDBLCLK, WM_LBUTTONUP:
			showMainWindow()
		case WM_RBUTTONUP:
			showTrayMenu()
		}
	case WM_COMMAND:
		switch wParam {
		case ID_SHOW:
			showMainWindow()
		case ID_EXIT:
			exitApp()
		}
	case WM_DESTROY:
		pPostQuitMessage.Call(0)
		return 0
	}
	ret, _, _ := pDefWindowProc.Call(uintptr(hwnd), uintptr(msg), wParam, lParam)
	return ret
}

func showMainWindow() {
	if wailsCtx != nil {
		runtime.WindowShow(wailsCtx)
		runtime.WindowUnminimise(wailsCtx)
	}
}

func exitApp() {
	if wailsCtx != nil {
		runtime.Quit(wailsCtx)
	}
}

func showTrayMenu() {
	hMenu, _, _ := pCreatePopupMenu.Call()
	if hMenu == 0 {
		return
	}

	showText, _ := windows.UTF16PtrFromString("Show MACE")
	exitText, _ := windows.UTF16PtrFromString("Exit MACE")

	pAppendMenu.Call(hMenu, MF_STRING, ID_SHOW, uintptr(unsafe.Pointer(showText)))
	pAppendMenu.Call(hMenu, MF_SEPARATOR, 0, 0)
	pAppendMenu.Call(hMenu, MF_STRING, ID_EXIT, uintptr(unsafe.Pointer(exitText)))

	var pt struct{ X, Y int32 }
	pGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))

	pSetForegroundWindow.Call(uintptr(trayHWnd))
	pTrackPopupMenu.Call(hMenu, TPM_LEFTALIGN|TPM_RIGHTBUTTON, uintptr(pt.X), uintptr(pt.Y), 0, uintptr(trayHWnd), 0)
}

func getIconFromICO(icoBytes []byte) (windows.Handle, error) {
	if len(icoBytes) < 6 {
		return 0, fmt.Errorf("invalid ICO header")
	}
	count := int(icoBytes[4]) | (int(icoBytes[5]) << 8)
	if count <= 0 {
		return 0, fmt.Errorf("no images in ICO")
	}

	bestIndex := -1
	bestWidth := 0
	targetSize := 16 // System tray icons are 16x16
	minDiff := 9999

	for i := 0; i < count; i++ {
		offset := 6 + i*16
		if offset+16 > len(icoBytes) {
			break
		}
		w := int(icoBytes[offset])
		if w == 0 {
			w = 256
		}
		h := int(icoBytes[offset+1])
		if h == 0 {
			h = 256
		}

		diff := w - targetSize
		if diff < 0 {
			diff = -diff
		}
		if diff < minDiff {
			minDiff = diff
			bestIndex = i
			bestWidth = w
		}
	}

	if bestIndex == -1 {
		return 0, fmt.Errorf("no suitable icon found")
	}

	entryOffset := 6 + bestIndex*16
	bytesInRes := uint32(icoBytes[entryOffset+8]) | (uint32(icoBytes[entryOffset+9]) << 8) | (uint32(icoBytes[entryOffset+10]) << 16) | (uint32(icoBytes[entryOffset+11]) << 24)
	imageOffset := uint32(icoBytes[entryOffset+12]) | (uint32(icoBytes[entryOffset+13]) << 8) | (uint32(icoBytes[entryOffset+14]) << 16) | (uint32(icoBytes[entryOffset+15]) << 24)

	if int(imageOffset+bytesInRes) > len(icoBytes) {
		return 0, fmt.Errorf("invalid image data range")
	}

	imageData := icoBytes[imageOffset : imageOffset+bytesInRes]

	pCreateIconFromResourceEx := user32.NewProc("CreateIconFromResourceEx")
	hIcon, _, err := pCreateIconFromResourceEx.Call(
		uintptr(unsafe.Pointer(&imageData[0])),
		uintptr(len(imageData)),
		1, // TRUE (icon)
		0x00030000, // Version
		uintptr(bestWidth),
		uintptr(bestWidth),
		0, // Flags (LR_DEFAULTCOLOR)
	)
	if hIcon == 0 {
		return 0, fmt.Errorf("CreateIconFromResourceEx failed: %v", err)
	}

	return windows.Handle(hIcon), nil
}
