"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderPlus, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDescendantFolderIds } from "@/lib/files";
import FolderNode, { type RenameState } from "./FolderNode";
import FileRow from "./FileRow";
import type { FileRecord, FolderRecord, PaneId } from "@/lib/types";

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
    const { data: userData, error: userError } =
      await supabase.auth.getUser();
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
    const { data: userData, error: userError } =
      await supabase.auth.getUser();
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
          setError(
            `Ошибка сохранения «${file.name}»: ${insertError.message}`,
          );
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
    if (
      !window.confirm(`Удалить папку «${folder.name}» со всем содержимым?`)
    ) {
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
    ? folders.find((f) => f.id === activeFolderId)?.name ?? "Корень"
    : "Корень";

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCreatingFolder(true);
              setNewFolderName("");
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FolderPlus size={14} />
            Новая папка
          </button>
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-slate-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
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
        <p className="truncate text-xs text-slate-500">
          Текущая папка:{" "}
          <span className="font-medium text-slate-700">
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
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCreateFolder}
              className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
            >
              ОК
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className={`mb-1 w-full rounded px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide ${
                activeFolderId === null
                  ? "bg-slate-100 text-slate-700"
                  : "text-slate-400 hover:bg-slate-50"
              }`}
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
              />
            ))}
            {rootFolders.length === 0 && rootFiles.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-slate-400">
                Пока нет файлов. Загрузите PDF, чтобы начать.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
