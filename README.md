# OtterWeaving

Kreator wzorów krajki tkanej **metodą tabliczkową** (tablet weaving, tabliczki 4-dziurowe) przeznaczonej do utkania **na bardku** (inkle loom). Aplikacja działa w całości w przeglądarce — bez backendu.

Autor: **Otter Solutions**

## Funkcje

- **Generator PNG → wzór**: wgraj obraz, dobierz liczbę tabliczek, rzędów i kolorów, wybierz tryb:
  - *Threaded-in (klasyczny)* — kolory z kolumn obrazu trafiają do nawleczenia tabliczek, obroty proste z odwracaniem kierunku co N rzędów;
  - *Wierny obrazowi* — algorytm DP dobiera obroty F/B per wiersz tak, by symulacja maksymalnie odwzorowywała obraz (najlepiej przy 2–3 kolorach).
- **Szybkie poprawki po generacji**: klikalne diagramy obrotów (F↔B), nawleczenia (kolory otworów, S/Z) i wątek, z undo/redo i licznikiem niezgodności z obrazem źródłowym.
- **Pełny edytor draftów**: tryby narzędzi, wypełnianie kolumn/wierszy, przesuwanie sekwencji, szablony (pasy, diagonale, jodełka), paleta z własnymi kolorami, zoom.
- **Wydruk A4**: podgląd tkaniny, diagram obrotów i nawleczenia, legenda, lista materiałów (liczba nitek, długość osnowy) i instrukcja montażu na bardku.
- **Galeria wzorów tabliczkowych**: 6 gotowych wzorów (pasy ozdobne, diagonale egipskie, diagonale trójkolorowe, jodełka, romby, plastry miodu) do otwarcia jednym kliknięciem.
- **Tryb inkle (krajka przerzucana)**: własny przepływ zakładek Kreator → Edytor → Wydruk (jak tabliczki) z diagramem nawleczenia (oczko/prześwit) i diagramem podnoszenia nitek (Baltic pickup), z malowaniem przeciąganiem, undo/redo i własnym autosave.
- **4 klasyczne wzory inkle**: gwiazda bałtycka, serce, romby i barani róg — z regulowaną liczbą powtórzeń (1–8).
- **Generator zdjęć → inkle**: wgraj PNG/JPG, dobierz liczbę nitek wzorcowych, rzędów i kolorów (tło auto z dominaty obrazu lub własne, 1–3 kolory nitek wzorcowych) i wygeneruj wzór pick-up.
- **Wydruk inkle**: nawleczenie, diagram podnoszenia, legenda, lista materiałów i instrukcja nawleczenia na bardku (A4).
- **Zapis projektów**: autosave w przeglądarce + eksport/import pliku `.otter.json`.

## Uruchomienie

```bash
npm install
npm run dev
```

## Skrypty

| Komenda | Opis |
| --- | --- |
| `npm run dev` | serwer deweloperski |
| `npm run build` | typecheck + budowanie produkcyjne |
| `npm run test` | testy jednostkowe (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | sprawdzenie typów TypeScript |

## Struktura

```
src/core    czysty TS bez DOM: model draftu, symulator tkania,
            kwantyzacja obrazu, generatory, metryki, eksport SVG,
            inkle (inkle.ts — krajka przerzucana, inkle-patterns.ts — wzory)
src/ui      widoki (tabliczki: Kreator, Wynik, Edytor, Wydruk; inkle:
            Kreator, Edytor, Wydruk) i komponenty wspólne
src/state   store (zustand) z historią undo/redo i autosave
src/i18n    słownik PL (przygotowane pod rozszerzenie o EN)
```

## Konwencje draftu

Diagram obrotów u góry (wiersz 1 = pierwszy tkany, ćwierćobrót: F — zgodnie ze wskazówkami zegara, B — przeciwnie), diagram nawleczenia na dole (otwory A–D od góry, S/Z kierunek nawleczenia). Symulator odsłania nitkę przed obrotem, stan początkowy: otwór D. Konwencja zweryfikowana względem wzorców referencyjnych (pasy, diagonale egipskie, jodełka) testami jednostkowymi.

## Licencja

Wszystkie prawa zastrzeżone — Otter Solutions.
