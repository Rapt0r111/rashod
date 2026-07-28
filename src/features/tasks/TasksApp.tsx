"use client";

import {
  CheckIcon,
  CaretDownIcon,
  ClipboardTextIcon,
  ListChecksIcon,
  PlusIcon,
  StackIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleFilter } from "@/components/collapsible-filter";
import { DisclosureContent } from "@/components/disclosure-content";
import { SearchSortControl, type SearchSortOption } from "@/components/search-sort-control";
import { filterListItems, sortListItems, type ListSortState } from "@/components/list-utils";
import { fetchTasksSnapshot, saveTask, setTaskCompleted, updateTask } from "./api";
import { filterTaskTree, taskProgress, taskTree, toggleTaskFilter, type TaskFilter } from "./logic";
import type { Task, TasksSnapshot } from "./types";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

const taskSortOptions: SearchSortOption[] = [
  { key: "alpha", label: "А–Я" },
];

export function TasksApp({
  initialSnapshot,
  canWrite,
}: {
  initialSnapshot: TasksSnapshot;
  canWrite: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<TaskFilter[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const [historyQuery, setHistoryQuery] = useState("");
  const [historySort, setHistorySort] = useState<ListSortState>({ key: "alpha", direction: "asc" });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [isCreating, setCreating] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setSnapshot(await fetchTasksSnapshot());
    } catch {
      setError("Не удалось обновить задачи.");
    }
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("roster", () => void refresh());
    return () => source.close();
  }, [refresh]);

  const tree = useMemo(() => taskTree(snapshot.active), [snapshot.active]);
  const allTasks = useMemo(
    () => [...snapshot.active, ...snapshot.history],
    [snapshot.active, snapshot.history],
  );
  const visible = useMemo(() => {
    return sortListItems(
      filterListItems(filterTaskTree(tree, filters), query, (item) => `${item.title} ${item.description}`),
      sort,
      { label: (item) => item.title, defaultCompare: (a, b) => a.sortOrder - b.sortOrder || b.createdAt - a.createdAt },
    );
  }, [filters, query, sort, tree]);
  const visibleHistory = useMemo(() => sortListItems(
    filterListItems(snapshot.history, historyQuery, (task) => `${task.title} ${task.description}`),
    historySort,
    { label: (task) => task.title, defaultCompare: (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0) },
  ), [historyQuery, historySort, snapshot.history]);
  const withSteps = tree.filter((item) => item.children.length > 0).length;

  async function create(parentId?: string) {
    if (isCreating || (!title.trim() && !parentId)) return;
    setCreating(true);
    try {
      setError(null);
      setSnapshot(await saveTask({ title, description, parentId }));
      setTitle("");
      setDescription("");
    } catch {
      setError("Не удалось сохранить задачу.");
    } finally {
      setCreating(false);
    }
  }

  async function setCompleted(id: string, completed: boolean) {
    if (pendingTaskId) return;
    setPendingTaskId(id);
    try {
      setError(null);
      setSnapshot(await setTaskCompleted(id, completed));
    } catch {
      setError(
        completed
          ? "Не удалось завершить задачу."
          : "Не удалось вернуть задачу.",
      );
    } finally {
      setPendingTaskId(null);
    }
  }

  return (
    <section className="grid min-w-0 max-w-280 gap-4 p-4.5 text-text-primary max-[760px]:gap-3 max-[760px]:p-3">
      <header className="relative flex items-end justify-between gap-6 overflow-hidden rounded-3xl border border-line bg-[radial-gradient(circle_at_89%_8%,oklch(70%_0.16_210/0.18),transparent_29%),linear-gradient(135deg,oklch(21%_0.055_286),oklch(15%_0.038_286))] p-6 shadow-(--shadow) max-[760px]:flex-col max-[760px]:items-start max-[760px]:p-4.75">
        <div className="relative z-1 min-w-0 [&>h1]:my-[9px_0_7px] [&>h1]:text-[clamp(32px,5vw,46px)] [&>h1]:font-extrabold [&>h1]:leading-[0.95] [&>h1]:tracking-tighter [&>p]:m-0 [&>p]:max-w-[61ch] [&>p]:text-sm [&>p]:leading-[1.55] [&>p]:text-text-secondary">
          <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.04em] text-cyan">
            <ClipboardTextIcon size={16} /> Рабочее пространство
          </span>
          <h1>Задачи</h1>
          <p>
            Планируйте работу короткими шагами. Завершённое надёжно переносится
            в историю.
          </p>
        </div>
        <div className="relative z-1 grid min-w-[min(100%,318px)] grid-cols-3 gap-2 max-[760px]:w-full [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1 [&>div]:rounded-[15px] [&>div]:border [&>div]:border-white/10 [&>div]:bg-white/4.5 [&>div]:p-2.75 [&>div]:backdrop-blur-[10px] [&>div>span]:overflow-hidden [&>div>span]:truncate [&>div>span]:text-[11px] [&>div>span]:font-bold [&>div>span]:text-text-muted [&>div>b]:font-mono [&>div>b]:text-[25px] [&>div>b]:leading-none" aria-label="Сводка задач">
          <div>
            <span>В работе</span>
            <b>{snapshot.active.length}</b>
          </div>
          <div>
            <span>С этапами</span>
            <b>{withSteps}</b>
          </div>
          <div className="text-green">
            <span>Завершено</span>
            <b className="font-mono text-green">{snapshot.history.length}</b>
          </div>
        </div>
      </header>

      {canWrite && (
        <form
          className="flex items-stretch gap-2.75 rounded-[18px] border border-line bg-bg-panel p-2.75 shadow-(--shadow) max-[760px]:flex-wrap max-[760px]:items-start"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="grid h-10.5 w-10.5 shrink-0 place-items-center rounded-[13px] bg-[linear-gradient(135deg,var(--accent),var(--cyan))] text-[oklch(12%_0.04_286)]">
            <PlusIcon size={19} />
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-[minmax(170px,0.9fr)_minmax(220px,1.5fr)] gap-2 max-[760px]:min-w-[calc(100%-54px)] max-[760px]:grid-cols-1">
            <label className="grid min-w-0 gap-1">
              <span className="text-[11px] font-bold text-text-muted">Название</span>
              <input
                className="min-h-10.5 min-w-0 rounded-[10px] border border-transparent bg-white/4.5 px-3 py-2.5 text-text-primary outline-none transition-[border-color,background,box-shadow] duration-200 hover:bg-white/[0.07] focus:border-accent focus:shadow-[0_0_0_3px_oklch(68%_0.19_302/0.16)]"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={240}
                placeholder="Что нужно сделать?"
                aria-label="Название новой задачи"
              />
            </label>
            <label className="grid min-w-0 gap-1">
              <span className="text-[11px] font-bold text-text-muted">Детали</span>
              <input
                className="min-h-10.5 min-w-0 rounded-[10px] border border-transparent bg-white/4.5 px-3 py-2.5 text-text-primary outline-none transition-[border-color,background,box-shadow] duration-200 hover:bg-white/[0.07] focus:border-accent focus:shadow-[0_0_0_3px_oklch(68%_0.19_302/0.16)]"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                placeholder="Контекст или ожидаемый результат"
                aria-label="Комментарий к новой задаче"
              />
            </label>
          </div>
          <button
            className="inline-flex min-h-10.5 shrink-0 items-center justify-center gap-2 self-end rounded-[10px] border-0 bg-accent px-3.75 font-extrabold text-[oklch(12%_0.04_286)] transition-[filter,transform] duration-200 hover:brightness-110 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-45 max-[760px]:w-full"
            type="submit"
            disabled={isCreating || !title.trim()}
          >
            <PlusIcon size={18} /> Создать
          </button>
        </form>
      )}
      {error && (
        <p className="m-0 text-red" role="alert">
          {error}
        </p>
      )}

      <div className="overflow-visible rounded-[20px] border border-line bg-bg-panel">
        <div className="flex min-h-14.5 items-center justify-between gap-3 border-b border-line bg-white/2.5 px-3.5 py-2.5 max-[760px]:flex-col max-[760px]:items-start [&>div:first-child]:flex [&>div:first-child]:items-baseline [&>div:first-child]:gap-2">
          <div>
            <span className="text-[13px] font-bold text-text-secondary">Активные</span>
            <strong>{visible.length}</strong>
          </div>
          <CollapsibleFilter
            className="w-[min(100%,520px)] max-[760px]:w-full"
            label="Фильтры задач"
            activeCount={
              filters.length + Number(Boolean(query.trim()))
            }
            onClear={() => {
              setFilters([]);
              setQuery("");
              setSort({ key: "alpha", direction: "asc" });
            }}
          >
            <SearchSortControl
              query={query}
              onQueryChange={setQuery}
              sort={sort}
              onSortChange={setSort}
              options={taskSortOptions}
              showSort={false}
              placeholder="Название или детали"
              ariaLabel="Поиск активных задач"
              flush
            />
            <div className="flex gap-1.25 overflow-x-auto scrollbar-none max-[760px]:w-full [&::-webkit-scrollbar]:hidden" aria-label="Тип задачи">
              <FilterButton
                active={filters.length === 0}
                onClick={() => setFilters([])}
              >
                Все
              </FilterButton>
              <FilterButton
                active={filters.includes("with-steps")}
                onClick={() => setFilters((current) => toggleTaskFilter(current, "with-steps"))}
              >
                С подзадачами
              </FilterButton>
              <FilterButton
                active={filters.includes("simple")}
                onClick={() => setFilters((current) => toggleTaskFilter(current, "simple"))}
              >
                Простые
              </FilterButton>
            </div>
          </CollapsibleFilter>
        </div>
        <div className="grid gap-px bg-line" aria-label="Активные задачи">
          {!visible.length && (
            <div className="grid min-h-57.5 place-items-center gap-2 bg-bg-panel p-5 text-center text-text-muted [&>strong]:text-text-secondary [&>span]:text-[13px]">
              <StackIcon size={28} />
              <strong>
                {tree.length ? "В этом фильтре задач нет" : "Список пока пуст"}
              </strong>
              <span>
                {tree.length
                  ? "Выберите другой фильтр."
                  : "Создайте первую задачу выше."}
              </span>
            </div>
          )}
          {visible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              tasks={allTasks}
              canWrite={canWrite}
              pendingTaskId={pendingTaskId}
              onSetCompleted={setCompleted}
              onSave={async (input) => {
                setPendingTaskId(input.id);
                try {
                  setSnapshot(await updateTask(input));
                } finally {
                  setPendingTaskId(null);
                }
              }}
              onAddSubtask={async (parentId, value) => {
                setPendingTaskId(parentId);
                try {
                  setSnapshot(await saveTask({ title: value, parentId }));
                } finally {
                  setPendingTaskId(null);
                }
              }}
            />
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-[18px] border border-line bg-bg-panel">
        <button
          className="flex w-full items-center gap-2.5 border-0 bg-transparent px-3.5 py-3.25 text-left text-text-secondary transition-colors duration-200 hover:bg-white/4.5 focus-visible:bg-white/4.5"
          type="button"
          onClick={() => setHistoryOpen((value) => !value)}
          aria-expanded={historyOpen}
        >
          <span className="grid h-7.75 w-7.75 shrink-0 place-items-center rounded-[10px] bg-[oklch(74%_0.16_145/0.12)] text-green">
            <ListChecksIcon size={18} />
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <strong className="text-sm text-text-primary">История выполнения</strong>
            <small className="text-xs text-text-muted max-[760px]:hidden">Завершённые задачи защищены от удаления</small>
          </span>
          <b className="font-mono text-text-muted">{snapshot.history.length}</b>
          <CaretDownIcon size={18} className={cx("shrink-0 text-text-muted transition-transform duration-200", historyOpen && "rotate-180")} aria-hidden="true" />
        </button>
        <DisclosureContent open={historyOpen}>
          <div className="grid gap-px border-t border-line bg-line">
            <SearchSortControl
              query={historyQuery}
              onQueryChange={setHistoryQuery}
              sort={historySort}
              onSortChange={setHistorySort}
              options={taskSortOptions}
              showSort={false}
              placeholder="Найти завершённую задачу"
              ariaLabel="Поиск истории задач"
            />
            {snapshot.history.length ? (
              visibleHistory.map((task) => (
                <article className="flex gap-2.5 bg-bg-panel p-3.5 text-text-secondary [&>div]:min-w-0 [&>div]:flex-1 [&_strong]:text-sm [&_strong]:text-text-primary [&_p]:my-0.75 [&_p]:text-[13px] [&_time]:text-[11px] [&_time]:text-text-muted" key={task.id}>
                  <span className="grid h-7.75 w-7.75 shrink-0 place-items-center rounded-[10px] bg-[oklch(74%_0.16_145/0.12)] text-green">
                    <CheckIcon size={14} weight="bold" />
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    {task.description && <p className="mt-1 text-[13px] leading-[1.45] text-text-secondary wrap-anywhere">{task.description}</p>}
                    <time>
                      {new Date(task.completedAt!).toLocaleString("ru-RU")}
                    </time>
                  </div>
                  {canWrite && (
                    <button
                      type="button"
                      className="inline-flex min-h-8 shrink-0 items-center justify-center self-center rounded-[10px] border border-line bg-transparent px-2.5 py-1.75 text-xs font-bold text-cyan transition-colors duration-200 hover:border-cyan hover:bg-[oklch(77%_0.14_191/0.12)] hover:text-text-primary focus-visible:border-cyan"
                      onClick={() => void setCompleted(task.id, false)}
                      disabled={pendingTaskId !== null}
                    >
                      Вернуть
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p className="m-0 bg-bg-panel p-3.5 text-[13px] text-text-muted">История пока пуста.</p>
            )}
            {snapshot.history.length > 0 && visibleHistory.length === 0 && <p className="m-0 bg-bg-panel p-3.5 text-[13px] text-text-muted">Поиск ничего не нашёл.</p>}
          </div>
        </DisclosureContent>
      </section>
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={active ? "inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-accent bg-accent px-2.25 py-1.75 text-xs font-extrabold text-[oklch(12%_0.04_286)] shadow-[0_0_0_2px_var(--accent),0_0_16px_oklch(68%_0.19_302/0.2)] transition-[background,border-color,box-shadow,color,filter] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-panel" : "inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-transparent bg-transparent px-2.25 py-1.75 text-xs font-bold text-text-muted transition-[background,border-color,color] duration-200 hover:bg-white/6 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-panel"}
      aria-pressed={active}
      onClick={onClick}
    >
      {active && <CheckIcon size={13} weight="bold" aria-hidden="true" />}
      {children}
    </button>
  );
}

function TaskCard({
  task,
  tasks,
  canWrite,
  pendingTaskId,
  onSetCompleted,
  onSave,
  onAddSubtask,
}: {
  task: Task & { children: Task[] };
  tasks: Task[];
  canWrite: boolean;
  pendingTaskId: string | null;
  onSetCompleted: (id: string, completed: boolean) => Promise<void>;
  onSave: (input: {
    id: string;
    title?: string;
    description?: string;
  }) => Promise<void>;
  onAddSubtask: (parentId: string, title: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [draftDescription, setDraftDescription] = useState(task.description);
  const [subtask, setSubtask] = useState("");
  const progress = taskProgress(task, tasks);
  const isPending = pendingTaskId === task.id;
  const isAnyPending = pendingTaskId !== null;
  const completion = progress
    ? Math.round((progress.complete / progress.total) * 100)
    : 0;
  async function save() {
    if (!draft.trim() || isAnyPending) return;
    await onSave({ id: task.id, title: draft, description: draftDescription });
    setEditing(false);
  }
  return (
    <article
      className={`relative overflow-hidden bg-bg-panel transition-colors duration-200 hover:bg-white/2.5 ${task.children.length > 0 ? "border-l-[3px] border-l-accent" : ""}`}
      data-has-children={task.children.length > 0 || undefined}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          className="grid h-6.75 w-6.75 shrink-0 place-items-center rounded-[10px] border-[1.5px] border-text-muted bg-transparent text-transparent transition-[border-color,color,background,transform] duration-200 hover:border-green hover:bg-green hover:text-[oklch(13%_0.04_286)] disabled:cursor-default"
          onClick={() => void onSetCompleted(task.id, true)}
          disabled={!canWrite || isAnyPending}
          aria-label={`Отметить задачу «${task.title}» выполненной`}
        >
          {isPending ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" /> : <CheckIcon size={16} weight="bold" />}
        </button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="grid gap-1.75">
              <input
                className="min-h-10.5 w-full min-w-0 rounded-[10px] border border-transparent bg-white/4.5 px-3 py-2.5 text-text-primary outline-none transition-[border-color,background,box-shadow] duration-200 hover:bg-white/[0.07] focus:border-accent focus:shadow-[0_0_0_3px_oklch(68%_0.19_302/0.16)]"
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Название задачи"
              />
              <input
                className="min-h-10.5 w-full min-w-0 rounded-[10px] border border-transparent bg-white/4.5 px-3 py-2.5 text-text-primary outline-none transition-[border-color,background,box-shadow] duration-200 hover:bg-white/[0.07] focus:border-accent focus:shadow-[0_0_0_3px_oklch(68%_0.19_302/0.16)]"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
                placeholder="Детали задачи"
                aria-label="Детали задачи"
              />
              <div>
                <button
                  type="button"
                  className="rounded-lg border border-transparent bg-accent px-2.5 py-1.5 text-xs font-bold text-[oklch(12%_0.04_286)] disabled:opacity-45"
                  onClick={() => void save()}
                  disabled={isAnyPending || !draft.trim()}
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-line bg-transparent px-2.5 py-1.5 text-xs font-bold text-text-secondary"
                  onClick={() => {
                    setDraft(task.title);
                    setDraftDescription(task.description);
                    setEditing(false);
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                className="border-0 bg-transparent p-0 text-left text-[15px] font-extrabold leading-[1.35] text-text-primary transition-colors hover:text-accent focus-visible:text-accent"
                type="button"
                onClick={() => canWrite && !isAnyPending && setEditing(true)}
              >
                {task.title}
              </button>
              {task.description && <p className="mt-1 text-[13px] leading-[1.45] text-text-secondary wrap-anywhere">{task.description}</p>}
            </>
          )}
          {progress && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="block h-1 w-[min(148px,42vw)] overflow-hidden rounded-full bg-white/9">
                <i className="block h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--cyan))]" style={{ width: `${completion}%` }} />
              </span>
              <small className="text-[11px] font-bold text-text-muted">
                {progress.complete} из {progress.total} подзадач
              </small>
            </div>
          )}
        </div>
        {(task.children.length > 0 || canWrite) && (
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-transparent bg-transparent text-text-muted transition-colors hover:border-line hover:bg-white/6 hover:text-text-primary focus-visible:border-line"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={
              expanded ? "Свернуть подзадачи" : "Развернуть подзадачи"
            }
          >
            <CaretDownIcon size={18} className={cx("shrink-0 text-text-muted transition-transform duration-200", expanded && "rotate-180")} aria-hidden="true" />
          </button>
        )}
      </div>
      {(task.children.length > 0 || canWrite) && (
        <DisclosureContent open={expanded}>
          <div className="mx-4 mb-4 ml-13.75 grid gap-2 border-l border-white/12 border-t pl-3.5 pt-3 max-[760px]:ml-10.25">
            {task.children.map((child) => (
              <div
                className={child.completedAt ? "flex min-w-0 items-center gap-2 text-[13px] text-text-secondary [&>span]:wrap-anywhere [&>span]:text-text-muted [&>span]:line-through" : "flex min-w-0 items-center gap-2 text-[13px] text-text-secondary [&>span]:wrap-anywhere"}
                key={child.id}
              >
                <button
                  type="button"
                  className={cx(
                    "grid h-5.25 w-5.25 shrink-0 place-items-center rounded-[7px] border-[1.5px] bg-transparent text-transparent transition-colors",
                    child.completedAt ? "border-green bg-green text-[oklch(13%_0.04_286)]" : "border-text-muted hover:border-green hover:bg-green hover:text-[oklch(13%_0.04_286)]",
                  )}
                  onClick={() =>
                    void onSetCompleted(child.id, !child.completedAt)
                  }
                  disabled={!canWrite || isAnyPending}
                  aria-label={
                    child.completedAt
                      ? `Подзадача «${child.title}» выполнена`
                      : `Отметить подзадачу «${child.title}» выполненной`
                  }
                >
                  <CheckIcon size={13} weight="bold" />
                </button>
                <span>{child.title}</span>
              </div>
            ))}
            {canWrite && (
              <form
                className="flex items-center gap-2 text-text-muted"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (subtask.trim() && !isAnyPending)
                    void onAddSubtask(task.id, subtask).then(() =>
                      setSubtask(""),
                    );
                }}
              >
                <PlusIcon size={15} />
                <input
                  className="min-h-9.5 min-w-0 flex-1 rounded-[10px] border border-transparent bg-white/4.5 px-2.5 py-2 text-[13px] text-text-primary outline-none transition-[border-color,background,box-shadow] duration-200 hover:bg-white/[0.07] focus:border-accent focus:shadow-[0_0_0_3px_oklch(68%_0.19_302/0.16)]"
                  value={subtask}
                  onChange={(event) => setSubtask(event.target.value)}
                  placeholder="Добавить подзадачу"
                  aria-label={`Подзадача для ${task.title}`}
                />
                <button className="rounded-[9px] border-0 bg-[oklch(67%_0.12_210/0.12)] px-2.5 py-2 text-xs font-extrabold text-cyan disabled:cursor-not-allowed disabled:opacity-45" type="submit" disabled={isAnyPending || !subtask.trim()}>
                  Добавить
                </button>
              </form>
            )}
          </div>
        </DisclosureContent>
      )}
    </article>
  );
}
