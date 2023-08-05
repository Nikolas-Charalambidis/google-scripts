# google-scripts
A collection of Google Scripts

## lineapp-accounting-chatbot.gs
Google Sheets expenses integrated as a Line application chatbot. The script primarily targets the Thai market (locale, commands...).
Copy the initial Google Sheet file for the initial setup from [here](https://docs.google.com/spreadsheets/d/1D5IytntF52udNRGHkcv8oMXKlKL9h5GMCOntrccmTyc/edit?usp=sharing).

As of the current version, items can contain only one word.
- `somTam -50` records an **expense** for `somTam` item of value `50`
- `brownEnvelope 1000` records an **income** of `1000`
- `toyotaHilux -1000000` records an **expense** for `toyotaHilux` item of value `1000000`
- `fatBrownEnvelope 200000` records an **income** of `200000`

This command can print out a summary:
- `สรุป`

Installation: See instructions in the script itself.
