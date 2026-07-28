<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:caveman-agent-rules -->
# Caveman brevity

Respond terse like smart caveman. Keep technical substance exact, code and commands unchanged, and drop filler. Use normal clarity for security warnings, destructive actions, or when compression would make instructions ambiguous.
<!-- END:caveman-agent-rules -->

<!-- BEGIN:rashod-project-rules -->
# Rashod project guardrails

- Preserve all Russian UI copy as UTF-8. If PowerShell prints mojibake, do not "fix" text blindly; verify with `python -c "Path(...).read_text(encoding='utf-8')"` or unicode escapes first.
- Groups UI must use the same custom controls as admin/reference sections: custom dropdown/listbox and styled checkbox chips, not bare native `<select>` or visible default checkboxes.
- Group assignment pickers are date-aware: available people for manual assignment must come from the selected date, not only today.
- Auto-rotation should top up missing assignments when `peoplePerDay` increases; do not skip a day just because it already has one assignment.
- Auto-rotation must avoid assigning the same person to multiple groups on the same date while conflict-free candidates exist; conflict fallback is allowed only when there are not enough candidates.
<!-- END:rashod-project-rules -->
