import { styles } from "./primitives";
export function RequestState({
  kind,
  title,
  detail,
}: {
  kind: "loading" | "empty" | "forbidden" | "conflict" | "error" | "success";
  title: string;
  detail: string;
}) {
  const tone =
    kind === "forbidden" || kind === "error"
      ? styles.noticeDanger
      : kind === "conflict"
        ? styles.noticeWarn
        : "";
  return (
    <section
      className={`${styles.notice} ${tone}`}
      role={kind === "error" || kind === "forbidden" ? "alert" : "status"}
      aria-live="polite"
    >
      <strong>{title}</strong>
      <p>{detail}</p>
    </section>
  );
}
