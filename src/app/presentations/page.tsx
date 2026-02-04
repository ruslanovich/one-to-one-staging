"use client";

import { useEffect, useRef, useState } from "react";
import {
  Input,
  Output,
  Conversion,
  BlobSource,
  BufferTarget,
  WebMOutputFormat,
  Mp4OutputFormat,
  ALL_FORMATS,
} from "mediabunny";
import "./presentations.css";
import { inferSourceKind, UploadKind } from "@/shared/uploadTypes";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GridIcon,
  LogoMark,
  PlusIcon,
  SettingsIcon,
  StarIcon,
  TrashIcon,
  UserIcon,
} from "../ui-kit/icons";

type SessionInfo = {
  authenticated: boolean;
  userId: string;
  orgId: string;
  role: string;
  email: string | null;
};

type PresentationItem = {
  id: string;
  source_filename: string | null;
  created_at: string;
  status: string;
  upload_status: string;
  upload_progress: number;
  analysis_id: string | null;
  analysis_created_at: string | null;
  headline_text: string | null;
  summary_text: string | null;
  bant_total_score: number | null;
  bant_total_max: number | null;
  bant_verdict: string | null;
};

export default function PresentationsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [items, setItems] = useState<PresentationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    setLoading(true);
    try {
      const sessionInfo = await fetchSession();
      if (!sessionInfo) {
        return;
      }
      await loadItems();
    } finally {
      setLoading(false);
    }
  }

  async function fetchSession(): Promise<SessionInfo | null> {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        window.location.href = "/login";
        return null;
      }
      const payload = (await response.json()) as SessionInfo;
      setSession(payload);
      return payload;
    } catch {
      setError("Не удалось загрузить данные пользователя.");
      return null;
    }
  }

  async function loadItems() {
    try {
      const response = await fetch("/api/presentations");
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        throw new Error("Не удалось загрузить презентации.");
      }
      const payload = (await response.json()) as { items: PresentationItem[] };
      setItems(payload.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки.");
    }
  }

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) {
      return;
    }

    setUploading(true);
    setUploadMessage("Загружаем файл...");
    setError(null);

    try {
      const sessionInfo = session ?? (await fetchSession());
      if (!sessionInfo) {
        return;
      }

      for (const file of files) {
        const uploadKind = resolveUploadKind(file);
        const preparedFile = await prepareFileForUpload(file, (progress) => {
          setUploadMessage(
            `Извлекаем аудио из ${file.name}... ${Math.round(progress * 100)}%`,
          );
        });
        setUploadMessage(`Загружаем ${preparedFile.name}...`);
        await uploadFile(sessionInfo, preparedFile, {
          sourceFileName: file.name,
          uploadKind,
        });
      }

      await loadItems();
      setUploadMessage("Файл загружен и отправлен в обработку.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить файл.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function uploadFile(
    sessionInfo: SessionInfo,
    file: File,
    meta: { sourceFileName: string; uploadKind: UploadKind },
  ) {
    const callId = crypto.randomUUID();

    const initResponse = await fetch("/api/uploads/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: sessionInfo.orgId,
        callId,
        fileName: file.name,
        sourceFileName: meta.sourceFileName,
        uploadKind: meta.uploadKind,
        contentType: file.type || "application/octet-stream",
        createdBy: sessionInfo.userId,
      }),
    });

    if (!initResponse.ok) {
      throw new Error("Не удалось подготовить загрузку.");
    }

    const initPayload = (await initResponse.json()) as {
      uploadId: string;
      objectKey: string;
    };

    const partResponse = await fetch("/api/uploads/part", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: initPayload.uploadId,
        objectKey: initPayload.objectKey,
        partNumber: 1,
      }),
    });

    if (!partResponse.ok) {
      throw new Error("Не удалось получить URL загрузки.");
    }

    const partPayload = (await partResponse.json()) as { uploadUrl: string };

    const uploadResponse = await fetch(partPayload.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Не удалось загрузить файл.");
    }

    const etag = uploadResponse.headers.get("etag") ?? uploadResponse.headers.get("ETag");
    const parts = etag ? [{ partNumber: 1, etag }] : [];

    const completeResponse = await fetch("/api/uploads/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: initPayload.uploadId,
        objectKey: initPayload.objectKey,
        parts,
        orgId: sessionInfo.orgId,
        callId,
        fileName: file.name,
        sourceFileName: meta.sourceFileName,
        uploadKind: meta.uploadKind,
        sizeBytes: file.size,
        mime: file.type || null,
      }),
    });

    if (!completeResponse.ok) {
      throw new Error("Не удалось завершить загрузку.");
    }
  }

  async function handleDelete(itemId: string) {
    const confirmed = window.confirm("Удалить презентацию? Это действие нельзя отменить.");
    if (!confirmed) return;

    setDeletingId(itemId);
    setError(null);
    setUploadMessage(null);
    try {
      const response = await fetch(`/api/presentations/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Не удалось удалить запись.");
      }
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setUploadMessage("Запись удалена.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить запись.");
    } finally {
      setDeletingId(null);
    }
  }

  const hasItems = items.length > 0;

  return (
    <div className="presentations-page">
      <aside className="presentations-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <LogoMark className="sidebar-logo" />
            <span className="sidebar-title">ONE TO ONE</span>
          </div>
          <button className="sidebar-toggle" type="button" aria-label="Свернуть меню">
            <ChevronLeftIcon />
          </button>
        </div>
        <nav className="sidebar-nav">
          <button className="sidebar-item" type="button">
            <UserIcon />
            Отдел
          </button>
          <button className="sidebar-item active" type="button">
            <GridIcon />
            Презентации
          </button>
          <button className="sidebar-item" type="button">
            <SettingsIcon />
            Настройки
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{getInitials(session?.email)}</div>
          <span>{session?.email ?? "—"}</span>
        </div>
      </aside>

      <main className="presentations-content">
        <header className="presentations-header">
          <div>
            <h1>Презентации</h1>
            <p className="presentations-subtitle">
              Загружайте материалы и следите за статусом обработки.
            </p>
          </div>
          <button
            className="primary-btn"
            type="button"
            onClick={handlePickFile}
            disabled={uploading}
          >
            <PlusIcon />
            {uploading ? "Загрузка..." : "Добавить презентацию"}
          </button>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.vtt,.webm,.mp4,.mp3,.wav,.ogg"
          className="file-input"
          onChange={handleFilesSelected}
        />

        {uploadMessage ? <div className="status-chip">{uploadMessage}</div> : null}
        {error ? <div className="error-chip">{error}</div> : null}

        {loading ? (
          <div className="loading-state">Загрузка...</div>
        ) : !hasItems ? (
          <section className="empty-state">
            <div className="empty-card">
              <div className="empty-icon">• •</div>
              <h2>У вас нет добавленных презентаций</h2>
              <p>Загрузите свою первую презентацию, чтобы проанализировать ее</p>
              <button className="primary-btn" type="button" onClick={handlePickFile}>
                <PlusIcon />
                Добавить презентацию
              </button>
            </div>
          </section>
        ) : (
          <section className="registry">

            <div className="registry-grid registry-head">
              <div></div>
              <div className="head-cell">Название презентации</div>
              <div className="head-cell">Менеджер</div>
              <div className="head-cell">Дата</div>
              <div className="head-cell">Раппорт</div>
              <div className="head-cell">Потребности</div>
              <div className="head-cell">Презентация</div>
              <div className="head-cell">Возражения</div>
              <div className="head-cell">Next step</div>
              <div className="head-cell">Итог</div>
              <div></div>
            </div>

            <div className="registry-body">
              {items.map((item) => {
                const title = item.headline_text || stripExtension(item.source_filename) || "Без названия";
                const dateLabel = formatDate(item.analysis_created_at ?? item.created_at);
                const details = item.summary_text
                  ? item.summary_text.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 3)
                  : null;
                const isReady = Boolean(item.analysis_id);
                const statusLabel = buildStatusLabel(item, isReady);
                const totalScore = computeTotalScore(item);

                return (
                  <div key={item.id} className="registry-row">
                    <div className="registry-grid">
                      <div className="row-icon">
                        {details ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      </div>
                      <div className="row-title">
                        <span>{title}</span>
                        {item.bant_verdict ? <span className="row-tag">BANT</span> : null}
                        {!isReady ? <span className="row-status">{statusLabel}</span> : null}
                      </div>
                      <div>—</div>
                      <div>{dateLabel}</div>
                      <div className="row-score">—</div>
                      <div className="row-score">—</div>
                      <div className="row-score">—</div>
                      <div className="row-score">—</div>
                      <div className="row-score">—</div>
                      <div className="row-score">
                        {totalScore ?? "—"}
                        {totalScore !== null && totalScore >= 4.9 ? <StarIcon className="star" /> : null}
                      </div>
                    <div className="row-actions">
                        <button
                          className="delete-btn"
                          type="button"
                          aria-label="Удалить"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                        >
                          <TrashIcon />
                        </button>
                    </div>
                    </div>

                    {details ? (
                      <div className="registry-details">
                        <ul>
                          {details.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function stripExtension(filename: string | null) {
  if (!filename) return "";
  const index = filename.lastIndexOf(".");
  return index > 0 ? filename.slice(0, index) : filename;
}

function resolveUploadKind(file: File): UploadKind {
  const kind = inferSourceKind(file.name);
  if (kind === "unknown") {
    throw new Error(
      "Неподдерживаемый формат. Разрешены mp4, webm, mp3, wav, ogg, vtt, txt.",
    );
  }
  return kind;
}

async function prepareFileForUpload(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<File> {
  if (!shouldExtractAudio(file)) {
    return file;
  }
  return extractAudioOnly(file, onProgress);
}

function shouldExtractAudio(file: File): boolean {
  const container = guessContainer(file);
  return container === "webm" || container === "mp4";
}

function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index === -1) return "";
  return filename.slice(index + 1).toLowerCase();
}

function guessContainer(file: File): "webm" | "mp4" | "unknown" {
  const ext = getFileExtension(file.name);
  if (ext === "webm" || file.type.includes("webm")) return "webm";
  if (ext === "mp4" || file.type.includes("mp4")) return "mp4";
  return "unknown";
}

async function extractAudioOnly(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<File> {
  const container = guessContainer(file);

  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  const target = new BufferTarget();
  let outFormat: WebMOutputFormat | Mp4OutputFormat;
  let outExt: "webm" | "m4a";
  let outType = "application/octet-stream";

  if (container === "webm") {
    outFormat = new WebMOutputFormat();
    outExt = "webm";
    outType = "audio/webm";
  } else if (container === "mp4") {
    outFormat = new Mp4OutputFormat();
    outExt = "m4a";
    outType = "audio/mp4";
  } else {
    outFormat = new WebMOutputFormat();
    outExt = "webm";
    outType = "audio/webm";
  }

  const output = new Output({
    format: outFormat,
    target,
  });

  const conversion = await Conversion.init({
    input,
    output,
    video: { discard: true },
  });

  if (!conversion.isValid) {
    const reasons = (conversion.discardedTracks || [])
      .map((track) => track.reason)
      .join("; ");
    throw new Error(
      `Conversion invalid. Discarded tracks: ${reasons || "unknown"}`,
    );
  }

  conversion.onProgress = (progress) => {
    if (onProgress) {
      onProgress(progress);
    }
  };

  await conversion.execute();

  const buffer = target.buffer;
  const blob = new Blob([buffer], { type: outType });
  if (blob.size === 0) {
    throw new Error("Извлеченный аудиофайл пустой.");
  }

  const baseName = stripExtension(file.name) || "audio";
  return new File([blob], `${baseName}.audio.${outExt}`, {
    type: outType,
  });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU");
}

function computeTotalScore(item: PresentationItem): number | null {
  if (!item.bant_total_score || !item.bant_total_max) {
    return null;
  }
  const score = (item.bant_total_score / item.bant_total_max) * 5;
  return Math.round(score * 10) / 10;
}

function buildStatusLabel(item: PresentationItem, ready: boolean) {
  if (ready) return "Готово";
  if (item.upload_status === "uploading") return `Загрузка ${item.upload_progress}%`;
  if (item.upload_status === "pending") return "Ожидание загрузки";
  if (item.status === "queued") return "В очереди";
  if (item.status === "processing") return "В обработке";
  if (item.status === "transcribed") return "Транскрибировано";
  return "В обработке";
}

function getInitials(email?: string | null) {
  if (!email) return "—";
  const local = email.split("@")[0] ?? "";
  const trimmed = local.replace(/[^a-zA-Zа-яА-Я0-9]/g, "");
  if (!trimmed) return "—";
  return trimmed.slice(0, 2).toUpperCase();
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
