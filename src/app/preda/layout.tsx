/**
 * Modul de predare live are layout propriu, în afara spațiului cu meniu.
 *
 * Brief §5 cere „mod de prezentare curat, fără controale administrative
 * vizibile": ecranul e proiectat sau partajat în Google Meet, iar orice element
 * de navigare a aplicației distrage de la lecție. De aceea nu reutilizăm
 * layout-ul profesorului — nu ascundem antetul prin CSS, pur și simplu nu e aici.
 */
export default function PresentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="ro" className="min-h-screen bg-canvas">
      {children}
    </div>
  );
}
