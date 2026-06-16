"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderPlus, Loader2, Search, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDescendantFolderIds } from "@/lib/files";
import FolderNode, { type RenameState } from "./FolderNode";
import FileRow from "./FileRow";
import {
  DRAG_MIME_TYPE,
  type DragPayload,
  type FileRecord,
  type FolderRecord,
  type PaneId,
} from "@/lib/types";

interface FileBrowserProps {
  onOpenFile: (file: FileRecord, pane: PaneId) => void;
  activeFiles: { left: string | null; right: string | null };
}

export default function FileBrowser({
  onOpenFile,
  activeFiles,
}: FileBrowserProps) {
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<RenameState | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [touchDrag, setTouchDrag] = useState<{
    payload: DragPayload;
    label: string;
  } | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [
      { data: folderData, error: folderError },
      { data: fileData, error: fileError },
    ] = await Promise.all([
      supabase.from("folders").select("*"),
      supabase.from("files").select("*"),
    ]);
    if (folderError) setError(folderError.message);
    if (fileError) setError(fileError.message);
    setFolders(folderData ?? []);
    setFiles(fileData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError(
        `Не удалось определить пользователя (сессия истекла). Перезайдите в аккаунт и попробуйте снова.${
          userError ? ` (${userError.message})` : ""
        }`,
      );
      setCreatingFolder(false);
      return;
    }

    const { error: insertError } = await supabase.from("folders").insert({
      user_id: userId,
      parent_id: activeFolderId,
      name,
    });
    if (insertError) setError(insertError.message);
    else if (activeFolderId) {
      setExpanded((prev) => new Set(prev).add(activeFolderId));
    }
    setNewFolderName("");
    setCreatingFolder(false);
    await loadData();
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    // Снимок файлов нужно сделать сразу: после await onChange успевает
    // сбросить input.value, что очищает живой объект FileList по ссылке.
    const filesToUpload = Array.from(fileList);

    const supabase = createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError(
        `Не удалось определить пользователя (сессия истекла). Перезайдите в аккаунт и попробуйте снова.${
          userError ? ` (${userError.message})` : ""
        }`,
      );
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of filesToUpload) {
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) continue;

        const path = `${userId}/${crypto.randomUUID()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("pdfs")
          .upload(path, file, { contentType: "application/pdf" });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          setError(`Ошибка загрузки «${file.name}»: ${uploadError.message}`);
          continue;
        }

        const { error: insertError } = await supabase.from("files").insert({
          user_id: userId,
          folder_id: activeFolderId,
          name: file.name,
          storage_path: path,
          size: file.size,
        });
        if (insertError) {
          console.error("Insert error:", insertError);
          setError(`Ошибка сохранения «${file.name}»: ${insertError.message}`);
        }
      }

      if (activeFolderId) {
        setExpanded((prev) => new Set(prev).add(activeFolderId));
      }
    } catch (err) {
      console.error("Unexpected upload error:", err);
      setError(
        `Непредвиденная ошибка загрузки: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      setUploading(false);
      await loadData();
    }
  };

  const handleDeleteFolder = async (folder: FolderRecord) => {
    if (!window.confirm(`Удалить папку «${folder.name}» со всем содержимым?`)) {
      return;
    }
    const supabase = createClient();
    const idsToDelete = getDescendantFolderIds(folders, folder.id);
    const filesToDelete = files.filter(
      (f) => f.folder_id && idsToDelete.includes(f.folder_id),
    );
    if (filesToDelete.length > 0) {
      await supabase.storage
        .from("pdfs")
        .remove(filesToDelete.map((f) => f.storage_path));
    }
    const { error: deleteError } = await supabase
      .from("folders")
      .delete()
      .eq("id", folder.id);
    if (deleteError) setError(deleteError.message);
    if (activeFolderId && idsToDelete.includes(activeFolderId)) {
      setActiveFolderId(folder.parent_id);
    }
    await loadData();
  };

  const handleMoveFile = async (
    fileId: string,
    targetFolderId: string | null,
  ) => {
    const file = files.find((f) => f.id === fileId);
    if (!file || file.folder_id === targetFolderId) return;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("files")
      .update({ folder_id: targetFolderId })
      .eq("id", fileId);
    if (updateError) setError(updateError.message);
    if (targetFolderId) {
      setExpanded((prev) => new Set(prev).add(targetFolderId));
    }
    await loadData();
  };

  const handleMoveFolder = async (
    folderId: string,
    targetFolderId: string | null,
  ) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    if (folderId === targetFolderId || folder.parent_id === targetFolderId) {
      return;
    }
    if (
      targetFolderId &&
      getDescendantFolderIds(folders, folderId).includes(targetFolderId)
    ) {
      setError("Невозможно переместить папку в одну из её вложенных папок.");
      return;
    }
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("folders")
      .update({ parent_id: targetFolderId })
      .eq("id", folderId);
    if (updateError) setError(updateError.message);
    if (targetFolderId) {
      setExpanded((prev) => new Set(prev).add(targetFolderId));
    }
    await loadData();
  };

  const handleStartTouchDrag = (
    payload: DragPayload,
    label: string,
    x: number,
    y: number,
  ) => {
    setTouchDrag({ payload, label });
    setGhostPos({ x, y });
  };

  // Обработка перетаскивания на тач-устройствах: после долгого нажатия
  // (см. useLongPressDrag) слушаем touchmove/touchend на всём документе,
  // подсвечиваем папку под пальцем и выполняем перемещение при отпускании.
  useEffect(() => {
    if (!touchDrag) return;

    const findTarget = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      return el?.closest<HTMLElement>("[data-drop-target]")?.dataset.dropTarget;
    };

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      setGhostPos({ x: t.clientX, y: t.clientY });
      setDragOverTarget(findTarget(t.clientX, t.clientY) ?? null);
    };

    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const targetId = findTarget(t.clientX, t.clientY);
      if (targetId !== undefined) {
        const folderId = targetId === "root" ? null : targetId;
        if (touchDrag.payload.type === "file") {
          handleMoveFile(touchDrag.payload.id, folderId);
        } else {
          handleMoveFolder(touchDrag.payload.id, folderId);
        }
      }
      setTouchDrag(null);
      setGhostPos(null);
      setDragOverTarget(null);
    };

    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touchDrag]);

  const handleDeleteFile = async (file: FileRecord) => {
    if (!window.confirm(`Удалить файл «${file.name}»?`)) return;
    const supabase = createClient();
    await supabase.storage.from("pdfs").remove([file.storage_path]);
    const { error: deleteError } = await supabase
      .from("files")
      .delete()
      .eq("id", file.id);
    if (deleteError) setError(deleteError.message);
    await loadData();
  };

  const startRenameFolder = (folder: FolderRecord) => {
    setRenaming({ type: "folder", id: folder.id });
    setRenameValue(folder.name);
  };

  const startRenameFile = (file: FileRecord) => {
    setRenaming({ type: "file", id: file.id });
    setRenameValue(file.name);
  };

  const submitRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim();
    const current = renaming;
    setRenaming(null);
    if (!name) return;

    const original =
      current.type === "folder"
        ? folders.find((f) => f.id === current.id)?.name
        : files.find((f) => f.id === current.id)?.name;
    if (name === original) return;

    const supabase = createClient();
    const table = current.type === "folder" ? "folders" : "files";
    const { error: updateError } = await supabase
      .from(table)
      .update({ name })
      .eq("id", current.id);
    if (updateError) setError(updateError.message);
    await loadData();
  };

  const cancelRename = () => setRenaming(null);

  const rootFolders = folders
    .filter((f) => f.parent_id === null)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const rootFiles = files
    .filter((f) => f.folder_id === null)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const activeFolderName = activeFolderId
    ? (folders.find((f) => f.id === activeFolderId)?.name ?? "Корень")
    : "Корень";

  const getFolderPath = (folderId: string | null): string => {
    if (!folderId) return "";
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return "";
    const parent = getFolderPath(folder.parent_id);
    return parent ? `${parent} › ${folder.name}` : folder.name;
  };

  const trimmed = searchQuery.trim().toLowerCase();
  const filteredFiles = trimmed
    ? files
        .filter((f) => f.name.toLowerCase().includes(trimmed))
        .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    : null;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-slate-200 p-3 dark:border-zinc-800">
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCreatingFolder(true);
              setNewFolderName("");
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <FolderPlus size={14} />
            Новая папка
          </button>
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-slate-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-700 dark:bg-violet-600 dark:hover:bg-violet-500">
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Загрузить PDF
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="truncate text-xs text-slate-500 dark:text-zinc-500">
          Текущая папка:{" "}
          <span className="font-medium text-slate-700 dark:text-zinc-300">
            {activeFolderName}
          </span>
        </p>
        {creatingFolder && (
          <div className="mt-2 flex gap-1.5">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") setCreatingFolder(false);
              }}
              placeholder="Название папки"
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder-zinc-600"
            />
            <button
              type="button"
              onClick={handleCreateFolder}
              className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              ОК
            </button>
          </div>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="border-b border-slate-200 px-3 py-2 dark:border-zinc-800">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-600"
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск файлов..."
            className="w-full rounded border border-slate-200 py-1 pl-6 pr-6 text-xs focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder-zinc-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-zinc-600 dark:hover:text-zinc-400"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 dark:text-zinc-600">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : filteredFiles !== null ? (
          filteredFiles.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-slate-400 dark:text-zinc-600">
              Ничего не найдено
            </p>
          ) : (
            <div>
              {filteredFiles.map((file) => (
                <div key={file.id}>
                  <FileRow
                    file={file}
                    level={0}
                    isActiveLeft={activeFiles.left === file.id}
                    isActiveRight={activeFiles.right === file.id}
                    isRenaming={
                      renaming?.type === "file" && renaming.id === file.id
                    }
                    renameValue={renameValue}
                    onOpen={onOpenFile}
                    onStartRename={startRenameFile}
                    onRenameValueChange={setRenameValue}
                    onRenameSubmit={submitRename}
                    onRenameCancel={cancelRename}
                    onDelete={handleDeleteFile}
                    onSetDragOverTarget={setDragOverTarget}
                    onStartTouchDrag={handleStartTouchDrag}
                  />
                  {file.folder_id && (
                    <p
                      className="pb-1 text-[10px] text-slate-400 dark:text-zinc-600"
                      style={{ paddingLeft: "28px" }}
                    >
                      {getFolderPath(file.folder_id)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverTarget !== "root") setDragOverTarget("root");
              }}
              onDragLeave={() => {
                if (dragOverTarget === "root") setDragOverTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData(DRAG_MIME_TYPE);
                setDragOverTarget(null);
                if (!raw) return;
                const payload: DragPayload = JSON.parse(raw);
                if (payload.type === "file") handleMoveFile(payload.id, null);
                else handleMoveFolder(payload.id, null);
              }}
              data-drop-target="root"
              className={[
                "mb-1 w-full rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide",
                dragOverTarget === "root"
                  ? "bg-blue-50 ring-1 ring-inset ring-blue-300 dark:bg-violet-900/40 dark:ring-violet-500"
                  : activeFolderId === null
                    ? "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
                    : "text-slate-400 hover:bg-slate-50 dark:text-zinc-600 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              Корень
            </button>
            {rootFolders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                folders={folders}
                files={files}
                level={0}
                expanded={expanded}
                activeFolderId={activeFolderId}
                activeFiles={activeFiles}
                renaming={renaming}
                renameValue={renameValue}
                onToggleExpand={toggleExpand}
                onSetActiveFolder={setActiveFolderId}
                onOpenFile={onOpenFile}
                onStartRenameFolder={startRenameFolder}
                onStartRenameFile={startRenameFile}
                onRenameValueChange={setRenameValue}
                onRenameSubmit={submitRename}
                onRenameCancel={cancelRename}
                onDeleteFolder={handleDeleteFolder}
                onDeleteFile={handleDeleteFile}
                onMoveFile={handleMoveFile}
                onMoveFolder={handleMoveFolder}
                dragOverTarget={dragOverTarget}
                onSetDragOverTarget={setDragOverTarget}
                onStartTouchDrag={handleStartTouchDrag}
              />
            ))}
            {rootFiles.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                level={0}
                isActiveLeft={activeFiles.left === file.id}
                isActiveRight={activeFiles.right === file.id}
                isRenaming={
                  renaming?.type === "file" && renaming.id === file.id
                }
                renameValue={renameValue}
                onOpen={onOpenFile}
                onStartRename={startRenameFile}
                onRenameValueChange={setRenameValue}
                onRenameSubmit={submitRename}
                onRenameCancel={cancelRename}
                onDelete={handleDeleteFile}
                onSetDragOverTarget={setDragOverTarget}
                onStartTouchDrag={handleStartTouchDrag}
              />
            ))}
            {rootFolders.length === 0 && rootFiles.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-slate-400 dark:text-zinc-600">
                Пока нет файлов. Загрузите PDF, чтобы начать.
              </p>
            )}
          </>
        )}
      </div>

      {touchDrag && ghostPos && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-900 shadow-lg dark:border-violet-500 dark:bg-violet-950 dark:text-violet-200"
          style={{ left: ghostPos.x, top: ghostPos.y }}
        >
          {touchDrag.label}
        </div>
      )}
    </aside>
  );
}
