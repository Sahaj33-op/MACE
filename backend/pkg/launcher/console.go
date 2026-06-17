package launcher

import (
	"fmt"
	"io"
	"strings"
	"sync"
)

type ConsoleBuffer struct {
	mu     sync.RWMutex
	Lines  []string
	maxSize int
}

var (
	buffers   = make(map[string]*ConsoleBuffer)
	buffersMu sync.RWMutex
	
	stdins   = make(map[string]io.WriteCloser)
	stdinsMu sync.RWMutex

	listeners   = make(map[string][]chan string)
	listenersMu sync.RWMutex
)

func getOrCreateBuffer(id string) *ConsoleBuffer {
	buffersMu.Lock()
	defer buffersMu.Unlock()
	if buf, ok := buffers[id]; ok {
		return buf
	}
	buf := &ConsoleBuffer{
		Lines:   make([]string, 0, 500),
		maxSize: 1000,
	}
	buffers[id] = buf
	return buf
}

// WriteLog appends a new log snippet to the buffer and broadcasts it.
func WriteLog(id string, text string) {
	buf := getOrCreateBuffer(id)
	buf.mu.Lock()

	lines := strings.Split(text, "\n")
	for _, line := range lines {
		trimmed := strings.TrimRight(line, "\r")
		if trimmed == "" && len(lines) > 1 {
			continue
		}
		
		buf.Lines = append(buf.Lines, trimmed)
		if len(buf.Lines) > buf.maxSize {
			buf.Lines = buf.Lines[1:]
		}

		broadcastLog(id, trimmed)

		ParseLogLineForPlayers(id, trimmed)
	}
	buf.mu.Unlock()
}

// GetLogs returns all cached logs for a server instance.
func GetLogs(id string) []string {
	buf := getOrCreateBuffer(id)
	buf.mu.RLock()
	defer buf.mu.RUnlock()
	
	copied := make([]string, len(buf.Lines))
	copy(copied, buf.Lines)
	return copied
}

// ClearLogs resets the buffer logs.
func ClearLogs(id string) {
	buf := getOrCreateBuffer(id)
	buf.mu.Lock()
	buf.Lines = make([]string, 0, 500)
	buf.mu.Unlock()
	ClearActivePlayers(id)
}

// RegisterStdin stores the process's standard input pipe.
func RegisterStdin(id string, stdin io.WriteCloser) {
	stdinsMu.Lock()
	stdins[id] = stdin
	stdinsMu.Unlock()
}

// UnregisterStdin removes the stdin reference.
func UnregisterStdin(id string) {
	stdinsMu.Lock()
	delete(stdins, id)
	stdinsMu.Unlock()
}

// WriteCommand sends a command to the Minecraft server stdin.
func WriteCommand(id string, cmd string) error {
	stdinsMu.RLock()
	stdin, ok := stdins[id]
	stdinsMu.RUnlock()

	if !ok || stdin == nil {
		return fmt.Errorf("server %s is not running or stdin is unavailable", id)
	}

	if !strings.HasSuffix(cmd, "\n") {
		cmd += "\n"
	}

	_, err := io.WriteString(stdin, cmd)
	return err
}

// SubscribeLogs registers a channel to receive live logs for an instance.
func SubscribeLogs(id string) chan string {
	ch := make(chan string, 100)
	listenersMu.Lock()
	listeners[id] = append(listeners[id], ch)
	listenersMu.Unlock()
	return ch
}

// UnsubscribeLogs cleans up log subscription channels.
func UnsubscribeLogs(id string, ch chan string) {
	listenersMu.Lock()
	defer listenersMu.Unlock()
	list := listeners[id]
	for i, c := range list {
		if c == ch {
			listeners[id] = append(list[:i], list[i+1:]...)
			close(ch)
			break
		}
	}
}

func broadcastLog(id string, logLine string) {
	listenersMu.RLock()
	chans, ok := listeners[id]
	listenersMu.RUnlock()
	if !ok {
		return
	}
	for _, ch := range chans {
		select {
		case ch <- logLine:
		default:
		}
	}
}

// CaptureConsole streams command stdout/stderr to the console buffer.
func CaptureConsole(id string, rc io.ReadCloser) {
	defer rc.Close()
	buf := make([]byte, 1024)
	for {
		n, err := rc.Read(buf)
		if n > 0 {
			WriteLog(id, string(buf[:n]))
		}
		if err != nil {
			break
		}
	}
}
