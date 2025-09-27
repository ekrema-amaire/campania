# campania# Campania – Pizza Online Bestellung

Dies ist eine Web-App für das Pizzahaus *Campania*.  
Kunden können online bestellen, zwischen Lieferung und Abholung wählen und ihre Bestellung direkt an das Admin-Panel senden.

## Features
- 📦 Warenkorb mit Live-Berechnung  
- 🚚 Lieferlogik mit PLZ-Prüfung (inkl. Liefergebühr, Mindestbestellwert, kostenlos ab bestimmtem Betrag)  
- 🛒 Mehrstufiger Checkout (Details → Übersicht → Bestellung)  
- 🔑 Konto-Login und Gast-Bestellung  
- 📊 Admin-Panel mit Live-Updates (SSE/Polling)  
- 🔔 Ton-Benachrichtigung bei neuen Bestellungen  

## Tech Stack
- **Frontend:** HTML, CSS, Vanilla JS  
- **Backend:** Node.js (Express)  
- **Storage:** JSON-Dateien (Bestellungen & PLZ-Regeln)  
- **Live-Updates:** Server-Sent Events (SSE)  

## Installation
```bash
git clone https://github.com/ekrema-amaire/campania.git
cd campania
npm install
