import { describe, expect, it } from "vitest";
import { GroupApiError, getGroupErrorMessage } from "@/features/groups/api";

describe("group API error messages", () => {
  it.each([
    [401, "Сессия истекла. Войдите снова."],
    [400, "Проверьте введённые данные и повторите попытку."],
    [403, "Недостаточно прав для этого действия."],
    [404, "Данные уже изменились или удалены. Обновите экран и повторите попытку."],
    [409, "Данные изменились в другой операции. Обновите экран и повторите попытку."],
    [429, "Слишком много запросов. Подождите немного и повторите попытку."],
    [500, "Сервер временно недоступен. Повторите попытку позже."],
  ])("maps HTTP %s to a recoverable Russian message", (status, expected) => {
    expect(
      getGroupErrorMessage(new GroupApiError("API_ERROR", status), "Операция не выполнена"),
    ).toBe(expected);
  });

  it("keeps a recovery hint for network failures", () => {
    expect(
      getGroupErrorMessage(new TypeError("Failed to fetch"), "Операция не выполнена"),
    ).toBe("Операция не выполнена. Проверьте соединение и повторите попытку.");
  });
  it("does not turn ineligible assignments into a conflict override", () => {
    expect(
      getGroupErrorMessage(
        new GroupApiError("GROUP_ASSIGNMENT_INELIGIBLE", 409, [], "excluded"),
        "Назначение не выполнено",
      ),
    ).toBe("Человек исключён из этой группы на выбранный день.");
    expect(
      getGroupErrorMessage(
        new GroupApiError("GROUP_ASSIGNMENT_OVERFILLED", 409),
        "Назначение не выполнено",
      ),
    ).toBe("На выбранную дату уже назначено нужное количество людей.");
  });
});
