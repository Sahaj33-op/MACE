import { useState, useEffect, useCallback } from "react";
import { Users, Crown, Shield, UserMinus, UserCheck, Ban, RefreshCw, Loader2, LogOut } from "lucide-react";
import { getActivePlayers, getPlayerRoles, sendCommand, onPlayersUpdated, offPlayersUpdated } from "../ipc/serverAPI";
import { useDialog } from "../context/DialogContext";

interface PlayerManagerProps {
  serverId: string;
  serverStatus: string;
}

export default function PlayerManager({ serverId, serverStatus }: PlayerManagerProps) {
  const { alert, dangerConfirm } = useDialog();
  const [activePlayersList, setActivePlayersList] = useState<string[]>([]);
  const [opsList, setOpsList] = useState<string[]>([]);
  const [whitelistList, setWhitelistList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const roles = await getPlayerRoles(serverId);
      setOpsList(roles.ops || []);
      setWhitelistList(roles.whitelisted || []);
    } catch (err) {
      console.error("Failed to fetch player roles:", err);
    }
  }, [serverId]);

  const fetchPlayers = useCallback(async () => {
    if (serverStatus !== "online" && serverStatus !== "starting" && serverStatus !== "restarting") {
      setActivePlayersList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const players = await getActivePlayers(serverId);
      setActivePlayersList(players || []);
      await fetchRoles();
    } catch (err) {
      console.error("Failed to fetch active players:", err);
    } finally {
      setLoading(false);
    }
  }, [serverId, serverStatus, fetchRoles]);

  useEffect(() => {
    fetchPlayers();

    if (serverStatus === "online") {
      const unsubscribe = onPlayersUpdated(serverId, (players: string[]) => {
        setActivePlayersList(players || []);
        fetchRoles();
      });
      return () => {
        unsubscribe();
        offPlayersUpdated(serverId);
      };
    }
  }, [serverId, serverStatus, fetchPlayers, fetchRoles]);

  const handleAction = async (playerName: string, actionType: "kick" | "ban" | "op" | "deop" | "whitelist" | "unwhitelist") => {
    let cmd = "";
    let confirmMsg = "";

    switch (actionType) {
      case "kick":
        const reason = window.prompt(`Enter kick reason for "${playerName}":`, "Kicked by administrator");
        if (reason === null) return;
        cmd = `kick ${playerName} ${reason}`;
        break;
      case "ban":
        confirmMsg = `Are you sure you want to ban "${playerName}"? This will add them to the blacklist.`;
        cmd = `ban ${playerName}`;
        break;
      case "op":
        cmd = `op ${playerName}`;
        break;
      case "deop":
        cmd = `deop ${playerName}`;
        break;
      case "whitelist":
        cmd = `whitelist add ${playerName}`;
        break;
      case "unwhitelist":
        cmd = `whitelist remove ${playerName}`;
        break;
    }

    if (confirmMsg) {
      const confirmed = await dangerConfirm(confirmMsg, "Confirm Action");
      if (!confirmed) return;
    }

    setActionLoading(`${playerName}-${actionType}`);
    try {
      await sendCommand(serverId, cmd);
      // Wait slightly for server file flush and re-fetch roles
      setTimeout(async () => {
        await fetchRoles();
        setActionLoading(null);
      }, 600);
    } catch (err: any) {
      await alert(`Failed to execute command: ${err.message || err}`, "Command Error");
      setActionLoading(null);
    }
  };

  const isOp = (name: string) => opsList.some(o => o.toLowerCase() === name.toLowerCase());
  const isWhitelisted = (name: string) => whitelistList.some(w => w.toLowerCase() === name.toLowerCase());

  if (serverStatus !== "online" && serverStatus !== "starting" && serverStatus !== "restarting") {
    return (
      <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--accent-color)" }}>
        <Users size={48} style={{ opacity: 0.2, marginBottom: "1rem" }} />
        <h3>Player Management Offline</h3>
        <p style={{ fontSize: "0.85rem", maxWidth: "400px", margin: "0.5rem auto 0" }}>
          Active players can only be viewed and managed when the server is running. Start the server to begin managing players.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Users size={20} />
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Active Players</h2>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "rgba(255,255,255,0.06)",
              color: "var(--accent-color)",
              fontWeight: 600,
            }}
          >
            {activePlayersList.length} Online
          </span>
        </div>
        <button
          onClick={fetchPlayers}
          disabled={loading}
          className="button-secondary"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, padding: "0.4rem 0.75rem" }}
        >
          {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--accent-color)" }}>
          <Loader2 size={28} className="spin" style={{ marginBottom: "0.5rem" }} />
          <p style={{ fontSize: "0.85rem" }}>Retrieving players information...</p>
        </div>
      ) : activePlayersList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--accent-color)", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "6px" }}>
          <Users size={36} style={{ opacity: 0.2, marginBottom: "0.75rem" }} />
          <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>No players online</p>
          <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
            No one is currently connected to this server.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {activePlayersList.map((player) => {
            const playerIsOp = isOp(player);
            const playerIsWhitelisted = isWhitelisted(player);

            return (
              <div
                key={player}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                }}
              >
                {/* Player details */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <img
                    src={`https://minotar.net/avatar/${player}/32.png`}
                    alt={player}
                    onError={(e) => {
                      e.currentTarget.src = "https://minotar.net/avatar/char/32.png";
                    }}
                    style={{
                      width: "32px",
                      height: "32px",
                      imageRendering: "pixelated",
                      border: "2px solid rgba(255,255,255,0.1)",
                      borderRadius: "2px",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#f3f4f6" }}>{player}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {playerIsOp && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "0.7rem",
                            padding: "1px 6px",
                            background: "rgba(234,179,8,0.15)",
                            border: "1px solid rgba(234,179,8,0.3)",
                            color: "#facc15",
                            borderRadius: "4px",
                            fontWeight: 600,
                          }}
                        >
                          <Crown size={10} /> OP
                        </span>
                      )}
                      {playerIsWhitelisted && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "0.7rem",
                            padding: "1px 6px",
                            background: "rgba(59,130,246,0.15)",
                            border: "1px solid rgba(59,130,246,0.3)",
                            color: "#60a5fa",
                            borderRadius: "4px",
                            fontWeight: 600,
                          }}
                        >
                          <Shield size={10} /> Whitelisted
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="mc-action-row" style={{ gap: "0.5rem" }}>
                  {/* OP / DEOP Toggle */}
                  <button
                    onClick={() => handleAction(player, playerIsOp ? "deop" : "op")}
                    disabled={actionLoading !== null}
                    className="button-secondary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      margin: 0,
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.8rem",
                      borderColor: playerIsOp ? "rgba(234,179,8,0.3)" : undefined,
                    }}
                  >
                    {actionLoading === `${player}-op` || actionLoading === `${player}-deop` ? (
                      <Loader2 size={13} className="spin" />
                    ) : playerIsOp ? (
                      <UserMinus size={13} style={{ color: "#facc15" }} />
                    ) : (
                      <Crown size={13} />
                    )}
                    {playerIsOp ? "De-op" : "Op"}
                  </button>

                  {/* Whitelist Toggle */}
                  <button
                    onClick={() => handleAction(player, playerIsWhitelisted ? "unwhitelist" : "whitelist")}
                    disabled={actionLoading !== null}
                    className="button-secondary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      margin: 0,
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.8rem",
                    }}
                  >
                    {actionLoading === `${player}-whitelist` || actionLoading === `${player}-unwhitelist` ? (
                      <Loader2 size={13} className="spin" />
                    ) : playerIsWhitelisted ? (
                      <UserMinus size={13} />
                    ) : (
                      <UserCheck size={13} />
                    )}
                    {playerIsWhitelisted ? "Unwhitelist" : "Whitelist"}
                  </button>

                  {/* Kick */}
                  <button
                    onClick={() => handleAction(player, "kick")}
                    disabled={actionLoading !== null}
                    className="button-secondary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      margin: 0,
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.8rem",
                    }}
                  >
                    {actionLoading === `${player}-kick` ? (
                      <Loader2 size={13} className="spin" />
                    ) : (
                      <LogOut size={13} />
                    )}
                    Kick
                  </button>

                  {/* Ban */}
                  <button
                    onClick={() => handleAction(player, "ban")}
                    disabled={actionLoading !== null}
                    className="button-tertiary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      margin: 0,
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.8rem",
                    }}
                  >
                    {actionLoading === `${player}-ban` ? (
                      <Loader2 size={13} className="spin" />
                    ) : (
                      <Ban size={13} />
                    )}
                    Ban
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
