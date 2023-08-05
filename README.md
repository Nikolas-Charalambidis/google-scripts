# google-scripts
A collection of Google Scripts

## lineapp-accounting-chatbot.gs
Google Sheets expenses integrated as a Line application chatbot. The script primarily targets the Thai market (locale, commands...).
Copy the initial Google Sheet file for the initial setup from [here](https://docs.google.com/spreadsheets/d/1D5IytntF52udNRGHkcv8oMXKlKL9h5GMCOntrccmTyc/edit?usp=sharing).

As of the current version, items can contain only one word.
- `pizza 250` records an expense for `pizza` item of value `250`
- `brownEnvelope -1000` records an income of `250`.

This command can print out a summary:
- `สรุป`

Installation: See instructions in the script itself.
