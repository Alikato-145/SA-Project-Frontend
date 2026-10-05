import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EmployeeContextPicker } from "./employee-picker";

const render = (
  context: Parameters<typeof EmployeeContextPicker>[0]["context"],
) =>
  renderToStaticMarkup(
    <EmployeeContextPicker
      className="field"
      context={context}
      onChange={() => undefined}
      selfLabel="ข้อมูลของคุณ"
      value=""
    />,
  );

test("employee picker is searchable only for management context", () => {
  const self = render({
    mode: "self",
    employee: {
      id: "41",
      employee_code: "EMP-041",
      display_name: "มะลิ ใจดี",
    },
  });
  const management = render({ mode: "management" });
  const missing = render({ mode: "missing" });
  const failed = render(null);

  expect(self).toContain("มะลิ ใจดี");
  expect(self).not.toContain("<input");
  expect(management).toContain("<input");
  expect(management).toContain("ขอบเขตสิทธิ์");
  expect(missing).toContain("บัญชียังไม่เชื่อมข้อมูลพนักงาน");
  expect(missing).not.toContain("<input");
  expect(failed).toContain('role="alert"');
});
