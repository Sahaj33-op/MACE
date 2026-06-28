package servermanager

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"mace/backend/pkg/launcher"
	"mace/backend/pkg/utils"
)

type ScheduledTask struct {
	ID             string `json:"id"`
	ServerID       string `json:"serverId"`       // empty or "all" for all servers
	ServerName     string `json:"serverName"`     // Cache or friendly name
	CronExpression string `json:"cronExpression"` // e.g. "0 4 * * *"
	Action         string `json:"action"`         // "start", "stop", "restart", "backup", or custom command
	LastRun        string `json:"lastRun"`        // RFC3339
}

var (
	tasksMu sync.Mutex
)

func tasksPath() string {
	localPath := filepath.Join("scheduled_tasks.json")
	if utils.FileExists(localPath) {
		return localPath
	}
	confDir, err := os.UserConfigDir()
	if err != nil {
		return localPath
	}
	maceDir := filepath.Join(confDir, "MACE")
	os.MkdirAll(maceDir, 0755)
	return filepath.Join(maceDir, "scheduled_tasks.json")
}

// LoadScheduledTasks reads tasks from disk.
func LoadScheduledTasks() ([]ScheduledTask, error) {
	tasksMu.Lock()
	defer tasksMu.Unlock()

	path := tasksPath()
	if !utils.FileExists(path) {
		return []ScheduledTask{}, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var list []ScheduledTask
	if err := json.Unmarshal(data, &list); err != nil {
		return nil, err
	}

	return list, nil
}

// SaveScheduledTasks writes tasks to disk.
func SaveScheduledTasks(list []ScheduledTask) error {
	tasksMu.Lock()
	defer tasksMu.Unlock()

	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(tasksPath(), data, 0644)
}

// lockedModifyTasks loads, modifies via the provided function, and saves tasks
// under a single critical section to prevent concurrent update races.
func lockedModifyTasks(modifyFn func(tasks *[]ScheduledTask) error) error {
	tasksMu.Lock()
	defer tasksMu.Unlock()

	path := tasksPath()
	var tasks []ScheduledTask
	if utils.FileExists(path) {
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if err := json.Unmarshal(data, &tasks); err != nil {
			return err
		}
	}
	if tasks == nil {
		tasks = []ScheduledTask{}
	}

	if err := modifyFn(&tasks); err != nil {
		return err
	}

	data, err := json.MarshalIndent(tasks, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// ListScheduledTasks is the Wails binding to retrieve tasks.
func ListScheduledTasks() ([]ScheduledTask, error) {
	return LoadScheduledTasks()
}

// CreateScheduledTask adds a new task.
func CreateScheduledTask(task ScheduledTask) (ScheduledTask, error) {
	if task.CronExpression == "" || task.Action == "" {
		return task, fmt.Errorf("missing cron expression or action")
	}

	// Validate cron format
	fields := strings.Fields(task.CronExpression)
	if len(fields) != 5 {
		return task, fmt.Errorf("invalid cron expression: must contain exactly 5 fields")
	}

	task.ID = fmt.Sprintf("task-%d", time.Now().UnixNano())
	task.LastRun = ""

	err := lockedModifyTasks(func(tasks *[]ScheduledTask) error {
		*tasks = append(*tasks, task)
		return nil
	})
	if err != nil {
		return task, err
	}

	return task, nil
}

// UpdateScheduledTask edits an existing task.
func UpdateScheduledTask(task ScheduledTask) error {
	if task.ID == "" || task.CronExpression == "" || task.Action == "" {
		return fmt.Errorf("missing ID, cron expression, or action")
	}

	// Validate cron format
	fields := strings.Fields(task.CronExpression)
	if len(fields) != 5 {
		return fmt.Errorf("invalid cron expression: must contain exactly 5 fields")
	}

	return lockedModifyTasks(func(tasks *[]ScheduledTask) error {
		for i, t := range *tasks {
			if t.ID == task.ID {
				(*tasks)[i].ServerID = task.ServerID
				(*tasks)[i].ServerName = task.ServerName
				(*tasks)[i].CronExpression = task.CronExpression
				(*tasks)[i].Action = task.Action
				return nil
			}
		}
		return fmt.Errorf("task not found")
	})
}

// DeleteScheduledTask removes a task.
func DeleteScheduledTask(id string) error {
	if id == "" {
		return fmt.Errorf("missing ID")
	}

	return lockedModifyTasks(func(tasks *[]ScheduledTask) error {
		for i, t := range *tasks {
			if t.ID == id {
				*tasks = append((*tasks)[:i], (*tasks)[i+1:]...)
				return nil
			}
		}
		return fmt.Errorf("task not found")
	})
}

// matchField checks if a value matches a cron field specification.
func matchField(field string, val int, minVal int, maxVal int) bool {
	if field == "*" {
		return true
	}

	parts := strings.Split(field, ",")
	if len(parts) > 1 {
		for _, p := range parts {
			if matchField(p, val, minVal, maxVal) {
				return true
			}
		}
		return false
	}

	if strings.Contains(field, "/") {
		subparts := strings.Split(field, "/")
		if len(subparts) != 2 {
			return false
		}
		step, err := strconv.Atoi(subparts[1])
		if err != nil || step <= 0 {
			return false
		}
		rangeStr := subparts[0]
		if rangeStr == "*" {
			return (val-minVal)%step == 0
		}
		if strings.Contains(rangeStr, "-") {
			rangeParts := strings.Split(rangeStr, "-")
			if len(rangeParts) != 2 {
				return false
			}
			start, err1 := strconv.Atoi(rangeParts[0])
			end, err2 := strconv.Atoi(rangeParts[1])
			if err1 != nil || err2 != nil {
				return false
			}
			if val < start || val > end {
				return false
			}
			return (val-start)%step == 0
		}
		offset, err1 := strconv.Atoi(rangeStr)
		if err1 != nil {
			return false
		}
		if val < offset {
			return false
		}
		return (val-offset)%step == 0
	}

	if strings.Contains(field, "-") {
		rangeParts := strings.Split(field, "-")
		if len(rangeParts) != 2 {
			return false
		}
		start, err1 := strconv.Atoi(rangeParts[0])
		end, err2 := strconv.Atoi(rangeParts[1])
		if err1 != nil || err2 != nil {
			return false
		}
		return val >= start && val <= end
	}

	exact, err := strconv.Atoi(field)
	if err == nil {
		return val == exact
	}

	return false
}

// MatchCron evaluates if time t matches the 5-field cron expression.
func MatchCron(expr string, t time.Time) bool {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return false
	}

	if !matchField(fields[0], t.Minute(), 0, 59) {
		return false
	}

	if !matchField(fields[1], t.Hour(), 0, 23) {
		return false
	}

	if !matchField(fields[2], t.Day(), 1, 31) {
		return false
	}

	if !matchField(fields[3], int(t.Month()), 1, 12) {
		return false
	}

	wd := int(t.Weekday())
	// Normalize Sunday: Go's Weekday() returns 0 for Sunday. Cron accepts both 0 and 7.
	if wd == 0 && matchField(fields[4], 7, 0, 7) {
		return true
	}
	if !matchField(fields[4], wd, 0, 6) {
		return false
	}

	return true
}

// StartCronScheduler launches the cron daemon ticker.
func StartCronScheduler() {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		lastProcessedMin := -1

		for range ticker.C {
			now := time.Now()
			currentMin := now.Minute()
			if currentMin == lastProcessedMin {
				continue
			}
			lastProcessedMin = currentMin

			tasks, err := LoadScheduledTasks()
			if err != nil {
				continue
			}

			executedAny := false
			for i, task := range tasks {
				if MatchCron(task.CronExpression, now) {
					go executeTaskAction(task)
					tasks[i].LastRun = now.Format(time.RFC3339)
					executedAny = true
				}
			}

			if executedAny {
				_ = SaveScheduledTasks(tasks)
			}
		}
	}()
}

func executeTaskAction(task ScheduledTask) {
	if task.ServerID == "" || task.ServerID == "all" {
		servers, err := ListServers()
		if err != nil {
			return
		}
		for _, inst := range servers {
			runSingleAction(inst.ID, task.Action)
		}
	} else {
		runSingleAction(task.ServerID, task.Action)
	}
}

func runSingleAction(serverID string, action string) {
	switch action {
	case "start":
		status := getStatus(serverID)
		if status == "offline" {
			launcher.WriteLog(serverID, "[MACE Scheduler] Triggered START server action")
			_, _ = StartServer(serverID)
		}
	case "stop":
		status := getStatus(serverID)
		if status == "online" || status == "starting" {
			launcher.WriteLog(serverID, "[MACE Scheduler] Triggered STOP server action")
			_, _ = StopServer(serverID)
		}
	case "restart":
		status := getStatus(serverID)
		launcher.WriteLog(serverID, "[MACE Scheduler] Triggered RESTART server action")
		if status == "online" || status == "starting" {
			_, _ = StopServer(serverID)
			go func() {
				offline := false
				for i := 0; i < 40; i++ {
					time.Sleep(500 * time.Millisecond)
					if getStatus(serverID) == "offline" {
						offline = true
						break
					}
				}
				if offline {
					_, _ = StartServer(serverID)
				} else {
					launcher.WriteLog(serverID, "[MACE Scheduler] Restart: stop did not reach offline in time, skipping start")
				}
			}()
		} else if status == "offline" {
			_, _ = StartServer(serverID)
		}
	case "backup":
		launcher.WriteLog(serverID, "[MACE Scheduler] Triggered BACKUP server action")
		_, _ = CreateBackupWithOptions(serverID, true, true, true)
	default:
		// Send command if it's a console command
		status := getStatus(serverID)
		if status == "online" {
			launcher.WriteLog(serverID, fmt.Sprintf("[MACE Scheduler] Executing console command: %s", action))
			_ = SendCommand(serverID, action)
		}
	}
}
