export function Loader() {
  return (
    <div
      className="relative aspect-square w-16.25"
      role="status"
      aria-label="Загрузка"
    >
      <span
        className="absolute rounded-full animate-loaderAnim shadow-[inset_0_0_0_3px] shadow-gray-800 dark:shadow-gray-100"
        aria-hidden="true"
      />
      <span
        className="absolute rounded-full animate-loaderAnim animation-delay shadow-[inset_0_0_0_3px] shadow-gray-800 dark:shadow-gray-100"
        aria-hidden="true"
      />
    </div>
  );
}
