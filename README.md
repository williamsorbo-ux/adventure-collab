# Plans

HUVUDFUNKTIONER PÅ EVENT-SIDAN (Tabs eller sektioner):
1. ÖVERSIKT: Visar destination, nedräkning till startdatum, vilka som deltar, samt en smart "Intents-banner" med anpassade platshållare för sponsrade partners (t.ex. "Boka transfer i Prag" eller "Topp 3 aktiviteter").
2. CHATT: En enkel, realtidsanpassad flödeschatt för sällskapet kopplad till eventet.
3. KOSTNADSDELNING (Splits):
   - Möjlighet att lägga till utgifter (Belopp, Valuta i dropdown t.ex. SEK, EUR, USD, CZK, Beskrivning, Vem som betalade).
   - Enkel fördelningsmodell: Dela lika eller procentuellt.
   - En sammanfattningsvy som visar vem som är skyldig vem, samt knappar för "Markera som betald" / länkar till betalningslösningar (Swish/Revolut-länkar).
4. MINNESBANK (Galleri):
   - En enkel uppladdningsfunktion för bilder och korta videor under resan.
   - Grid-vy för alla uppladdade minnen.

TEKNISK STRUKTUR:
Använd Supabase som backend för att spara Events, Expenses, Messages och Media så att länken kan delas direkt till kompisar utan tvingande inloggning (gärna "guest join by name" via delningslänk).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://adventure-collab.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5db74911-d7bd-48ff-9777-8dd03eac7030).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
