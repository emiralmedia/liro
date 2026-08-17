# Brief de produs — platformă de învățare a limbii române pentru vorbitori de rusă

## 1. Scop și rezultat urmărit

Se dorește o aplicație web care simplifică activitatea unui profesor de limba română care predă individual cursanților vorbitori de rusă. Platforma centralizează materialele, parcursul fiecărui cursant, lecțiile, exercițiile, temele, corectarea și programările, înlocuind munca împrăștiată între agende, fișiere, Google Drive și aplicații de mesagerie.

Profesorul trebuie să petreacă mai puțin timp cu operațiuni repetitive și mai mult timp cu predarea, explicațiile, nuanțele, adaptarea ritmului și motivația cursantului.

## 2. Domeniu și lansare inițială

- Niveluri: **A1, A2 și B1**.
- Predare: **unu-la-unu** în prima versiune; modelul de date va permite ulterior grupe.
- Lecții live: în **Google Meet**; aplicația nu include apel video propriu în MVP.
- Dispozitive: experiență **desktop-first** pentru profesor și predarea live; experiență optimizată pentru telefon pentru cursant, în special la exerciții, audio și verificarea progresului.
- Mesagerie internă: în afara primei versiuni.
- Plăți: în afara primei versiuni, dacă nu se decide altfel.
- Interfață cursant: **rusă**. Interfața profesorului: română.

## 3. Utilizatori și permisiuni

### Profesor

Profesorul poate crea sau activa cursanți, naviga biblioteca curriculară, edita conținut, aloca și debloca lecții, atribui teme, programa și reprograma lecții, urmări progresul și suprascrie corectările automate.

### Cursant

Cursantul vede exclusiv propriul parcurs, lecțiile deblocate, temele, feedbackul, progresul și următoarea lecție. Nu vede alți cursanți, conținut nealocat sau administrarea platformei.

### Administrator (pregătit pentru extindere)

Rol destinat gestionării conturilor, conținutului global, drepturilor și rapoartelor. Nu este obligatoriu ca interfață separată în primul MVP, dar trebuie susținut în arhitectură.

## 4. Model curricular și conținut

Structura este:

**Nivel → modul/temă → lecție → secțiune → exercițiu**

O temă are un traseu recomandat de până la aproximativ cinci lecții de 60 de minute. Nu este rigid: profesorul poate aloca unui cursant două, trei sau toate lecțiile unei teme, le poate ordona, sări, reactiva sau completa cu recapitulare.

Fiecare lecție conține:

- obiective măsurabile;
- teorie în română, cu explicații și sprijin în rusă;
- vocabular activ și pasiv;
- exemple contextuale română–rusă;
- exerciții ghidate;
- material audio și exerciții de înțelegere;
- recapitulare;
- temă și criterii de finalizare.

Conținutul trebuie să anticipeze dificultățile tipice ale rusofonilor: articolul hotărât, genul și acordul, prepozițiile, pronumele, ordinea cuvintelor, diacriticele și pronunția.

Toate materialele sunt create inițial cu asistență AI, dar sunt editabile de profesor într-o zonă de administrare. Lecțiile publicate sunt versiunate: o modificare nouă nu schimbă retroactiv conținutul ori rezultatele parcurse deja de un cursant.

## 5. Funcționalități esențiale

### Bibliotecă de materiale

Profesorul găsește rapid conținutul după nivel, temă, obiectiv, competență și tip de exercițiu. Poate edita teoria, exemplele, baremele, variantele acceptate, audio-ul și temele, fără modificări de cod.

### Parcurs individual controlat

Lecțiile sunt blocate implicit. Profesorul alege pentru fiecare cursant ce lecții se activează și când. Cursantul lucrează numai în conținutul deblocat.

### Exerciții și evaluare

MVP-ul include alegere multiplă, completare, asociere, ordonare, răspuns scurt și întrebări după audio. Fiecare exercițiu este corectat automat inițial. Profesorul poate accepta formulări alternative, modifica punctajul, respinge verdictul automat și adăuga feedback. Decizia profesorului este verdictul final.

Răspunsurile libere sau ambigue sunt tratate ca recomandări pentru revizuire, nu ca verdicte absolute.

### Audio

Audio-ul are player cu play/pauză, reluare pe fragmente și viteză ajustabilă. Transcrierea este ascunsă inițial și poate fi dezvăluită ulterior, pentru a nu compromite exercițiul de listening. Audio-ul trebuie validat pedagogic și lingvistic înainte de publicare.

### Pronunție

Prima versiune include un demo funcțional sau placeholder de înregistrare vocală, fără evaluare automată de pronunție. Arhitectura va permite adăugarea ulterioară a încărcării audio, a feedbackului profesorului și, opțional, a evaluării asistate de AI.

### Teme și restanțe

O temă are stări: neîncepută, în lucru, trimisă, corectată și restantă. Dacă nu este predată la termen, devine restantă și se reportează automat la următoarea lecție; rămâne prioritară până la rezolvare, coexistând cu tema nouă. Profesorul poate modifica termenul, accepta întârzierea sau marca tema ca opțională.

### Programare și reprogramare

Aplicația afișează următoarea întâlnire și permite cerere de reprogramare cu cel puțin 24 de ore înainte. Sub acest prag, cererea nu este acceptată automat; politica de taxare sau excepție rămâne configurabilă de profesor.

### Dashboard de progres

Pentru profesor, dashboardul „Astăzi” arată cursanții următori, lecția curentă, temele și restanțele, exercițiile care cer revizuire, rezultate recente și dificultăți recurente. Pentru cursant, ecranul principal arată acțiunea curentă, restanțele, progresul și următoarea întâlnire.

Progresul combină lecții parcurse, teme finalizate, scoruri, încercări, timp și tipare de greșeli. Este un semnal de sprijin; profesorul decide întotdeauna avansarea.

## 6. Fluxuri principale

1. Profesorul deschide profilul cursantului înainte de lecție, vede situația pe scurt și selectează materialul.
2. Profesorul predă lecția live din modul de prezentare curat, fără controale administrative vizibile.
3. Profesorul deblochează lecția sau tema pentru lucru individual și stabilește termenul.
4. Cursantul parcurge teoria, audio-ul și exercițiile de pe laptop sau telefon; primește feedback imediat.
5. Platforma calculează progresul și semnalează dificultățile ori cazurile neclare.
6. Profesorul revizuiește doar excepțiile, adaptează traseul și deblochează următorul pas.

## 7. UX/UI

Designul este calm, lizibil, accesibil și neinfantilizant. Fiecare ecran are o acțiune principală clară: deblochează, începe, continuă, predă sau revizuiește.

Profesorul are spații distincte pentru dashboard, profil de cursant, bibliotecă de curriculum, editor de conținut, mod live și revizuirea corectărilor. Cursantul vede un parcurs foarte simplu, în limba rusă: ce are de făcut acum, tema restantă, progresul și următoarea întâlnire.

Sunt obligatorii contrast bun, fonturi lizibile, navigare din tastatură pe laptop, butoane mari pe mobil, salvare automată și reluarea facilă după întreruperea conexiunii.

## 8. Arhitectură tehnică recomandată

- Aplicație web responsive construită cu **Next.js și TypeScript**.
- API TypeScript și **PostgreSQL** ca sursă unică de adevăr.
- Stocare de obiecte pentru audio și atașamente.
- Procesare asincronă pentru audio, notificări, rapoarte și sarcini AI.
- Roluri și autorizare strictă: profesorul vede numai cursanții alocați, iar cursantul numai propriile date.
- Jurnal de audit pentru alocări, deblocări, încercări, corectări și modificări ale conținutului.
- Backup, export de date, monitorizare de erori, performanță și costuri AI.

Arhitectura trebuie să pregătească, fără a livra acum, grupe, plăți, integrare de calendar, notificări extinse, înregistrări vocale și analiză de pronunție.

## 9. Rolurile AI

AI este un asistent controlat de profesor, nu autoritate pedagogică autonomă.

- **Agent curriculum:** propune structura, prerechizitele și progresia A1–A2–B1.
- **Agent autor de lecții:** generează prime variante de teorie, dialoguri, exerciții, bareme și feedback.
- **Agent lingvistic bilingv:** verifică traducerea și adaptarea rusă–română, inclusiv interferențele specifice.
- **Agent QA pedagogic:** verifică nivelul CEFR, obiectivele, ambiguitățile și coerența dintre teorie, audio și exerciții.
- **Agent de progres:** rezumă pentru profesor ce stăpânește cursantul, unde se blochează și ce recapitulare ar putea ajuta; nu avansează automat cursantul.
- **Agent de corectare semantică:** etapă ulterioară; tratează răspunsurile libere cu scor de încredere și trimite cazurile incerte la profesor.

Niciun conținut generat de AI nu devine disponibil cursanților fără validare editorială. Fiecare item are obiectiv didactic, nivel, răspuns canonic, variante admise și explicație.

## 10. Securitate și date

Se colectează doar datele necesare pentru predare. Înregistrările sau datele personale nu sunt trimise către servicii AI fără justificare, configurare și consimțământ adecvat. Sunt necesare politici clare de retenție, drepturi de acces și ștergere/export al datelor. Pentru minori, cerințele de consimțământ și protecție trebuie definite înainte de lansare.

## 11. Indicatori de succes

- timp redus pentru pregătirea unei lecții;
- timp redus pentru distribuirea și urmărirea temelor;
- procentul exercițiilor rezolvate fără intervenție a profesorului;
- timpul necesar profesorului pentru a înțelege situația unui cursant;
- rata de finalizare a temelor și recuperare a restanțelor;
- activitatea cursanților între lecțiile live;
- finalizarea modulelor;
- satisfacția profesorului și a cursanților.

## 12. Etape recomandate

1. **Fundație:** conturi, roluri, bibliotecă A1–A2–B1, alocare/deblocare, exerciții obiective, teme/restanțe și progres.
2. **Experiența educațională:** audio, mod de predare live, dashboard, reprogramare și intervenția profesorului asupra corectării.
3. **AI editorial și analiză:** generare asistată, validare, QA și recomandări de progres.
4. **Extensii:** grupe, pronunție, notificări avansate, plăți și integrări de calendar.

## 13. Criteriu de acceptare al MVP-ului

Profesorul poate pregăti și susține o lecție individuală fără să caute fișiere în alte servicii, poate debloca rapid următorul material și poate înțelege în câteva secunde progresul, restanțele și problemele unui cursant. Cursantul poate lucra singur, în rusă, în lecțiile alocate, primește feedback clar și știe permanent ce are de făcut în continuare.
