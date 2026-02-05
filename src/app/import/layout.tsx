export default function ImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No footer on import page - canvas needs full height
  return <>{children}</>;
}
