import { useState, useEffect, useRef } from "react";
import { Cpu, HardDrive, Clock, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { getServerResources } from "../ipc/serverAPI";

interface ResourceMonitorProps {
  serverId: string;
  serverStatus: string;
  allocatedMemoryMB: number;
}

interface ResourceData {
  cpuPercent: number;
  memoryMB: number;
  uptime: number;
}

function formatUptime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function ProgressBar({
  value,
  max,
  color,
  label,
  displayValue,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  displayValue: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.75rem",
        }}
      >
        <span style={{ color: "var(--accent-color)" }}>{label}</span>
        <span style={{ fontWeight: 600, color: "var(--text-color)" }}>
          {displayValue}
        </span>
      </div>
      <div
        style={{
          height: "10px",
          background: "var(--primary-color)",
          border: "1px solid var(--hr-top-color)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${pct}%`,
            background: color,
            transition: "width 0.6s ease-in-out",
            boxShadow: `0 0 6px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}

export default function ResourceMonitor({
  serverId,
  serverStatus,
  allocatedMemoryMB,
}: ResourceMonitorProps) {
  const [resources, setResources] = useState<ResourceData | null>(null);
  const [history, setHistory] = useState<{ cpu: number; mem: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem("mace-resource-collapsed") === "true");

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem("mace-resource-collapsed", String(next));
      return next;
    });
  };

  const isRunning =
    serverStatus === "online" ||
    serverStatus === "starting" ||
    serverStatus === "restarting";

  useEffect(() => {
    if (!isRunning) {
      setResources(null);
      setHistory([]);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const fetchResources = async () => {
      try {
        const data = await getServerResources(serverId);
        setResources(data);
        setHistory((prev) => {
          const next = [
            ...prev,
            { cpu: data.cpuPercent, mem: data.memoryMB },
          ];
          return next.length > 30 ? next.slice(-30) : next;
        });
      } catch {
        // Server not ready yet or process ended
      }
    };

    fetchResources();
    intervalRef.current = setInterval(fetchResources, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [serverId, isRunning]);

  if (!isRunning) return null;

  const cpuColor =
    (resources?.cpuPercent ?? 0) > 80
      ? "var(--error-color)"
      : (resources?.cpuPercent ?? 0) > 50
      ? "var(--warning-color)"
      : "var(--success-color)";

  const memPct =
    resources && allocatedMemoryMB > 0
      ? (resources.memoryMB / allocatedMemoryMB) * 100
      : 0;
  const memColor =
    memPct > 90
      ? "var(--error-color)"
      : memPct > 70
      ? "var(--warning-color)"
      : "var(--btn-primary-inner-color)";

  return (
    <div
      className="card"
      style={{
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: isCollapsed ? "0" : "1rem",
      }}
    >
      {/* Header */}
      <div
        onClick={toggleCollapsed}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Activity
            size={16}
            style={{ color: "var(--btn-primary-inner-color)" }}
          />
          <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>
            Resource Usage
          </span>
          {isCollapsed ? <ChevronDown size={16} style={{ color: "var(--accent-color)" }} /> : <ChevronUp size={16} style={{ color: "var(--accent-color)" }} />}
        </div>
        {resources && !isCollapsed && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.75rem",
              color: "var(--accent-color)",
            }}
          >
            <Clock size={12} />
            <span>{formatUptime(resources.uptime)}</span>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          {!resources ? (
            <div
              style={{
                textAlign: "center",
                padding: "1rem",
                color: "var(--accent-color)",
                fontSize: "0.8rem",
              }}
            >
              Collecting resource data...
            </div>
          ) : (
        <>
          {/* Stat Boxes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                background: "var(--primary-color)",
                border: "1px solid var(--hr-top-color)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Cpu size={16} style={{ color: cpuColor, flexShrink: 0 }} />
              <div>
                <div
                  style={{ fontSize: "0.65rem", color: "var(--accent-color)" }}
                >
                  CPU
                </div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: cpuColor }}>
                  {resources.cpuPercent.toFixed(1)}%
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "0.75rem",
                background: "var(--primary-color)",
                border: "1px solid var(--hr-top-color)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <HardDrive
                size={16}
                style={{ color: memColor, flexShrink: 0 }}
              />
              <div>
                <div
                  style={{ fontSize: "0.65rem", color: "var(--accent-color)" }}
                >
                  Memory
                </div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: memColor }}>
                  {resources.memoryMB.toFixed(0)}
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--accent-color)",
                      marginLeft: "2px",
                    }}
                  >
                    MB
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "0.75rem",
                background: "var(--primary-color)",
                border: "1px solid var(--hr-top-color)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Clock size={16} style={{ color: "var(--accent-color)", flexShrink: 0 }} />
              <div>
                <div
                  style={{ fontSize: "0.65rem", color: "var(--accent-color)" }}
                >
                  Uptime
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  {formatUptime(resources.uptime)}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <ProgressBar
              value={resources.cpuPercent}
              max={100}
              color={cpuColor}
              label="CPU Usage"
              displayValue={`${resources.cpuPercent.toFixed(1)}%`}
            />
            <ProgressBar
              value={resources.memoryMB}
              max={allocatedMemoryMB}
              color={memColor}
              label="Memory Usage"
              displayValue={`${resources.memoryMB.toFixed(0)} / ${allocatedMemoryMB} MB`}
            />
          </div>

          {/* Mini Sparkline Chart */}
          {history.length > 1 && (
            <div style={{ position: "relative" }}>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--accent-color)",
                  marginBottom: "4px",
                }}
              >
                CPU History (last 60s)
              </div>
              <svg
                viewBox={`0 0 ${history.length - 1} 100`}
                preserveAspectRatio="none"
                style={{
                  width: "100%",
                  height: "40px",
                  background: "var(--primary-color)",
                  border: "1px solid var(--hr-top-color)",
                  display: "block",
                }}
              >
                {/* Fill area */}
                <path
                  d={
                    `M0,${100 - Math.min(history[0].cpu, 100)} ` +
                    history
                      .map(
                        (h, i) =>
                          `L${i},${100 - Math.min(h.cpu, 100)}`
                      )
                      .join(" ") +
                    ` L${history.length - 1},100 L0,100 Z`
                  }
                  fill="var(--btn-primary-inner-color)"
                  fillOpacity="0.15"
                />
                {/* Line */}
                <polyline
                  points={history
                    .map(
                      (h, i) =>
                        `${i},${100 - Math.min(h.cpu, 100)}`
                    )
                    .join(" ")}
                  fill="none"
                  stroke="var(--btn-primary-inner-color)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          )}
        </>
      )}
    </>
  )}
    </div>
  );
}
