"use client";

import { useState } from "react";
import { CheckIcon } from "@phosphor-icons/react";
import type { GroupTemplate } from "../types";
import { colorTokenClass } from "../utils";
import { GROUP_NAME_MAX_LENGTH, GROUP_NOTES_MAX_LENGTH } from "./constants";
import { Drawer } from "./drawer";
import { EmptyState } from "./empty-state";
import { iconMap } from "./shared-meta";
import { ClipboardTextIcon } from "@phosphor-icons/react";

export function CreateGroupPanel({
  templates,
  isBusy,
  onClose,
  onCreate,
}: {
  templates: GroupTemplate[];
  isBusy: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    templateId: string;
    notes: string;
  }) => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const selected = templates.find((item) => item.id === templateId);
  const [name, setName] = useState(selected?.name ?? "");
  const [notes, setNotes] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const nameError = nameTouched && !name.trim() ? "Введите название группы." : null;

  return (
    <Drawer title="Новая группа" onClose={onClose}>
      {templates.length === 0 ? (
        <EmptyState
          title="Нет шаблонов для группы"
          text="Добавьте шаблон в справочниках, затем вернитесь к созданию группы."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {templates.map((template) => {
              const Icon =
                iconMap[template.icon as keyof typeof iconMap] ?? ClipboardTextIcon;
              return (
                <button
                  key={template.id}
                  type="button"
                  className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-2xl border border-(--tone-line) bg-[oklch(100%_0_0/0.035)] p-2.5 text-left text-text-primary transition-[border-color,background,transform] duration-200 hover:border-accent-line hover:bg-[oklch(100%_0_0/0.065)] cursor-pointer active:translate-y-px ${templateId === template.id ? "border-(--tone-line) bg-(--tone-soft)" : ""} ${colorTokenClass(template.colorToken)}`}
                  onClick={() => {
                    setTemplateId(template.id);
                    setName(template.name);
                  }}
                  disabled={isBusy}
                  aria-pressed={templateId === template.id}
                >
                  <Icon size={22} weight="duotone" />
                  <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                    {template.name}
                  </strong>
                  <small className="col-start-2 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-text-muted">
                    {template.defaultPeoplePerDay} чел.
                  </small>
                </button>
              );
            })}
          </div>
          <label className="grid min-w-0 gap-1.75">
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
              Название
            </span>
            <input
              className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-base text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setNameTouched(true)}
              maxLength={GROUP_NAME_MAX_LENGTH}
              required
              aria-invalid={nameError ? true : undefined}
              aria-describedby="create-group-name-hint"
            />
            <small
              id="create-group-name-hint"
              className={nameError ? "text-xs text-red" : "text-[11px] text-text-muted"}
            >
              {nameError ?? `До ${GROUP_NAME_MAX_LENGTH} символов.`}
            </small>
          </label>
          <label className="grid min-w-0 gap-1.75">
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-extrabold text-text-secondary">
              Заметка
            </span>
            <textarea
              className="w-full min-w-0 rounded-xl border border-line bg-[oklch(100%_0_0/0.045)] px-2.75 py-2.5 text-base text-text-primary outline-none focus:border-cyan focus:ring-2 focus:ring-[oklch(77%_0.14_191/0.1)]"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={GROUP_NOTES_MAX_LENGTH}
            />
          </label>
          <button
            type="button"
            className="inline-flex min-h-9.5 w-full max-w-full min-w-0 items-center justify-center gap-1.75 overflow-hidden rounded-xl border border-accent-line bg-accent px-3.25 text-center text-[13px] font-extrabold text-[oklch(98%_0.01_286)] transition-[background,border-color,transform] duration-200 cursor-pointer active:translate-y-px"
            disabled={isBusy || !name.trim() || !templateId}
            onClick={() => onCreate({ name: name.trim(), templateId, notes })}
          >
            Создать
          </button>
        </>
      )}
    </Drawer>
  );
}

