"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Bell, Check, CheckCheck, ChevronLeft, RefreshCw,
  Inbox, WifiOff, Search, Trash2, XCircle, FileX, Wifi,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useWebSocketNotifications } from "@/hooks/useWebSocketNotifications"
import type { Notification, DeleteLog } from "@/types/notification"
import { getDeleteLogs } from "@/lib/api"

function formatRelative(timestamp: string) {
  try { return formatDistanceToNow(new Date(timestamp), { addSuffix: true }) }
  catch { return "Just now" }
}

export default function NotificationsPage() {
  const router = useRouter()
  const { notifications, unreadCount, isConnected, markAsRead, markAllAsRead, refetch, removeNotificationsLocal } =
    useWebSocketNotifications()

  const [query, setQuery]           = useState("")
  const [view, setView]             = useState<"unread" | "all">("unread")
  const [tab, setTab]               = useState<"notifications" | "deletelogs">("notifications")
  const [selectedIds, setSelectedIds]   = useState<number[]>([])
  const [deletingIds, setDeletingIds]   = useState<number[]>([])
  const [deleteLogs, setDeleteLogs]     = useState<DeleteLog[]>([])
  const [deleteLogsLoading, setDeleteLogsLoading] = useState(false)
  const [deleteLogsFeature, setDeleteLogsFeature] = useState("")
  const [deleteLogsLastSeen, setDeleteLogsLastSeen] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!Array.isArray(notifications)) return []
    const q = query.toLowerCase().trim()
    return notifications.filter(n =>
      (!q || n.verb?.toLowerCase().includes(q) || n.target_text?.toLowerCase().includes(q) || n.actor_name?.toLowerCase().includes(q)) &&
      (view === "all" ? true : n.unread)
    )
  }, [notifications, query, view])

  const toggleSelect = (id: number) =>
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleDeleteSelected = () => {
    if (!selectedIds.length) return
    setDeletingIds(selectedIds)
    setTimeout(() => { removeNotificationsLocal(selectedIds); setSelectedIds([]); setDeletingIds([]) }, 220)
  }

  const handleDeleteAllVisible = () => {
    const ids = filtered.map(n => n.id)
    if (!ids.length) return
    setDeletingIds(ids)
    setTimeout(() => { removeNotificationsLocal(ids); setSelectedIds([]); setDeletingIds([]) }, 220)
  }

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) markAllAsRead()
    if (deleteLogsUnreadCount > 0) {
      const now = new Date().toISOString()
      setDeleteLogsLastSeen(now)
      if (typeof window !== "undefined") {
        localStorage.setItem("delete_logs_last_seen", now)
        window.dispatchEvent(new Event("delete-logs-read"))
      }
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("delete_logs_last_seen")
      if (s) setDeleteLogsLastSeen(s)
    }
  }, [])

  useEffect(() => {
    async function fetch() {
      setDeleteLogsLoading(true)
      try { const r = await getDeleteLogs(deleteLogsFeature || undefined, 50); setDeleteLogs(r.results || []) }
      catch { setDeleteLogs([]) }
      finally { setDeleteLogsLoading(false) }
    }
    fetch()
    const t = setInterval(fetch, 10000)
    return () => clearInterval(t)
  }, [deleteLogsFeature])

  const deleteLogsUnreadCount = useMemo(() => {
    if (tab === "deletelogs") return 0
    if (!deleteLogs.length) return 0
    if (!deleteLogsLastSeen) {
      const ago = new Date(Date.now() - 86400000)
      return deleteLogs.filter(l => new Date(l.timestamp) > ago).length
    }
    const seen = new Date(deleteLogsLastSeen)
    return deleteLogs.filter(l => new Date(l.timestamp) > seen).length
  }, [deleteLogs, deleteLogsLastSeen, tab])

  useEffect(() => {
    if (tab === "deletelogs" && deleteLogs.length > 0) {
      const now = new Date().toISOString()
      setDeleteLogsLastSeen(now)
      if (typeof window !== "undefined") localStorage.setItem("delete_logs_last_seen", now)
    }
  }, [tab, deleteLogs])

  const filteredDeleteLogs = useMemo(() => {
    if (!Array.isArray(deleteLogs)) return []
    return deleteLogs
  }, [deleteLogs])

  return (
    <div className="max-w-8xl mx-auto px-6 sm:px-8 py-4 sm:py-8 space-y-4">

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        <div className="bg-gradient-to-br from-[#1a3a5c] to-[#2a5298] px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Notification Center</h1>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium
                ${isConnected ? "text-emerald-300" : "text-red-300"}`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? "Live" : "Offline"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-center px-3.5 py-2 bg-white/10 rounded-xl border border-white/20">
              <p className="text-lg font-black text-white leading-none">{unreadCount}</p>
              <p className="text-[10px] text-white/60 uppercase tracking-wide mt-0.5">Unread</p>
            </div>
            <div className="text-center px-3.5 py-2 bg-white/10 rounded-xl border border-white/20">
              <p className="text-lg font-black text-white leading-none">{filtered.length}</p>
              <p className="text-[10px] text-white/60 uppercase tracking-wide mt-0.5">Showing</p>
            </div>
            <button onClick={() => refetch()}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center justify-center text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100">
          {([
            { key: "notifications", label: "Notifications", badge: unreadCount },
            { key: "deletelogs",    label: "Delete Logs",   badge: deleteLogsUnreadCount },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors
                ${tab === t.key
                  ? "border-[#2a4e78] text-[#2a4e78]"
                  : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t.label}
              {t.badge > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white
                  ${t.key === "deletelogs" ? "bg-red-500" : "bg-[#2a4e78]"}`}>
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Notifications Tab ── */}
        {tab === "notifications" && (
          <>
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search notifications…"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20 focus:bg-white transition-colors" />
              </div>

              <div className="inline-flex bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
                {(["unread", "all"] as const).map(opt => (
                  <button key={opt} onClick={() => setView(opt)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                      ${view === opt ? "bg-white text-[#2a4e78] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {opt === "unread" ? "Unread" : "All"}
                  </button>
                ))}
              </div>

              {(unreadCount > 0 || deleteLogsUnreadCount > 0) && (
                <button onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2a4e78] hover:bg-[#2a4e78]/8 px-3 py-2 rounded-lg border border-[#2a4e78]/20 transition-colors flex-shrink-0">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}

              {filtered.length > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={handleDeleteSelected} disabled={!selectedIds.length}
                    className="p-2 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 disabled:opacity-30 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={handleDeleteAllVisible}
                    className="p-2 rounded-lg border border-gray-100 text-gray-400 hover:bg-gray-50 transition-colors">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Notification List */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-gray-200" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-500">All caught up!</p>
                  <p className="text-xs text-gray-400 mt-0.5">No notifications to show.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {filtered.map(n => (
                  <NotificationRow key={n.id} notification={n}
                    selected={selectedIds.includes(n.id)}
                    onToggleSelect={toggleSelect}
                    onMarkAsRead={id => markAsRead(id)}
                    isDeleting={deletingIds.includes(n.id)} />
                ))}
              </ul>
            )}
          </>
        )}

        {/* ── Delete Logs Tab ── */}
        {tab === "deletelogs" && (
          <>
            {/* Filter */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <select value={deleteLogsFeature} onChange={e => setDeleteLogsFeature(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a4e78]/20">
                <option value="">All Features</option>
                <option value="attendance">Attendance</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="coordinator">Coordinator</option>
                <option value="principal">Principal</option>
                <option value="classroom">Classroom</option>
                <option value="grade">Grade</option>
                <option value="level">Level</option>
                <option value="campus">Campus</option>
                <option value="user">User</option>
              </select>
              <button onClick={() => setDeleteLogsFeature("")}
                className="p-2 border border-gray-100 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {deleteLogsLoading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : filteredDeleteLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
                  <FileX className="w-7 h-7 text-red-200" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-500">No delete logs</p>
                  <p className="text-xs text-gray-400 mt-0.5">No deletion records found.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {filteredDeleteLogs.map(log => <DeleteLogRow key={log.id} log={log} />)}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Notification Row ── */
function NotificationRow({ notification, selected, onToggleSelect, onMarkAsRead, isDeleting = false }: {
  notification: Notification; selected: boolean
  onToggleSelect: (id: number) => void; onMarkAsRead: (id: number) => void; isDeleting?: boolean
}) {
  const u = notification.unread
  return (
    <li className={`relative flex items-start gap-3 px-5 py-4 transition-all duration-200
      ${u ? "bg-[#f4f7ff] border-l-[3px] border-l-[#2a4e78]" : "bg-white border-l-[3px] border-l-transparent hover:bg-gray-50/60"}
      ${isDeleting ? "opacity-0 translate-x-3 scale-[0.98] pointer-events-none" : ""}`}>

      <button type="button" onClick={() => onToggleSelect(notification.id)}
        className={`mt-1 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
          ${selected ? "bg-[#2a4e78] border-[#2a4e78]" : "border-gray-300 bg-white hover:border-[#2a4e78]/50"}`}>
        {selected && <Check className="w-2.5 h-2.5 text-white" />}
      </button>

      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
        ${u ? "bg-[#2a4e78] text-white" : "bg-gray-100 text-gray-400"}`}>
        <Bell className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug ${u ? "text-gray-900" : "text-gray-500"}`}>
          {notification.verb}
        </p>
        {notification.target_text && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{notification.target_text}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {notification.actor_name && <span className="text-[11px] font-medium text-gray-400">{notification.actor_name}</span>}
          <span className="text-[11px] text-gray-300">·</span>
          <span className="text-[11px] text-gray-400">{formatRelative(notification.timestamp)}</span>
          {u && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#2a4e78]/10 text-[#2a4e78]">New</span>}
        </div>
      </div>

      {u && (
        <button onClick={() => onMarkAsRead(notification.id)}
          className="mt-1 p-1.5 rounded-lg text-gray-300 hover:text-[#2a4e78] hover:bg-[#2a4e78]/8 transition-colors flex-shrink-0">
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
    </li>
  )
}

/* ── Delete Log Row ── */
function DeleteLogRow({ log }: { log: DeleteLog }) {
  return (
    <li className="flex items-start gap-3 px-5 py-4 hover:bg-red-50/30 transition-colors border-l-[3px] border-l-red-300">
      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <FileX className="w-4 h-4 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 line-clamp-1">
          {log.feature_display} — {log.entity_name || `${log.entity_type} #${log.entity_id}`}
        </p>
        {log.reason && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{log.reason}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span className="text-[11px] text-gray-400">{log.user_name}</span>
          <span className="text-[11px] text-gray-300">·</span>
          <span className="text-[11px] text-gray-400">{formatRelative(log.timestamp)}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-500">{log.action_display}</span>
        </div>
      </div>
    </li>
  )
}
