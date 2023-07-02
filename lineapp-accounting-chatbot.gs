/****************************************************************************
 * lineapp-accounting-chatbot 1.0.0
 * Nikolas Charalambidis 2013 | Forked from https://gist.github.com/iton5/eb11191e7ce340d0a006429a1b4316ca
 ****************************************************************************/

/**
 * Timezone.
 * @type {string}
 */
const TIME_ZONE = "Asia/Bangkok";

/**
 * Replace 'xxx' with the Line access token.
 * For example: '+pHoa+pF84EAkH6WgIspLKE5z'
 * Don't forge to wrap it between the single-quotation marks and remember, the link can be much longer than in the example.
 * @type {string}
 */
const ACCESS_TOKEN = 'xxx';

/**
 * Replace 'xxx' with the Google Sheet edit URL.
 * For example: 'https://docs.google.com/spreadsheets/d/2csFUCjBP8/edit'
 * Don't forge to wrap it between the single-quotation marks and remember, the link can be much longer than in the example.
 * @type {string}
 */
const GOOGLE_SHEET_URL = 'xxx';

/**
 * Replace 'xxx' with the Google Sheet individual sheet name.
 * For example: 'sheet1'
 * Don't forge to wrap it between the single-quotation marks and remember, the link can be much longer than in the example.
 * @type {string}
 */
const GOOGLE_SHEET_NAME = 'xxx';

const GOOGLE_SHEET = SpreadsheetApp.openByUrl(GOOGLE_SHEET_URL).getSheetByName(GOOGLE_SHEET_NAME);
const LINE_API_REPLY = 'https://api.line.me/v2/bot/message/reply';

/**
 * Main method.
 */
function doPost(e) {
	try {
		const data = JSON.parse(e.postData.contents).events[0];
		const userMessage = data.message.text;
		console.log("Data: ", userMessage);

		var result;
		if (userMessage === "สรุป" || userMessage === "sum" || userMessage === "summary") {
			console.log("Requesting summary...");
			result = summary();
		} else {
			console.log("Adding data...: ", userMessage);
			result = change(userMessage);
		}
		reply(data, result);
	} catch (error) {
		console.log("🚫 SCRIPT ERROR", error);
		reply(data, "🚫 SCRIPT ERROR\n\n" + error);
	}
}

/**
 * Performs a REST API call to Line API to reply the current user.
 *
 * @param data Data for sake of reply token
 * @param msg Message for the user
 * @return {*} HTTP 200 OK response
 */
function reply(data, msg) {
	UrlFetchApp.fetch(LINE_API_REPLY, {
		'headers': {
			'Content-Type': 'application/json; charset=UTF-8',
			'Authorization': 'Bearer ' + ACCESS_TOKEN,
		},
		'method': 'post',
		'payload': JSON.stringify({
			'replyToken': data.replyToken,
			'messages': [{
				'type': 'text',
				'text': msg,
			}],
		}),
	});

	return ContentService
		.createTextOutput(JSON.stringify({'content': 'post ok'}))
		.setMimeType(ContentService.MimeType.JSON);
}

/**
 * Returns summary from the data in the Google Sheet as a message to be returned to the user.
 *
 * @returns {string} User message
 */
function summary() {
	const lastRowIndex = getLastRowIndex();

	const capital = GOOGLE_SHEET.getRange(1, 7).getDisplayValue();
	const income = GOOGLE_SHEET.getRange(2, 7).getDisplayValue();
	const expenses = GOOGLE_SHEET.getRange(3, 7).getDisplayValue();
	const balance = GOOGLE_SHEET.getRange(4, 7).getDisplayValue();

	let result = separator();

	// short-circuiting
	if (lastRowIndex === 1) {
		console.log("Short-circuiting because of 0 items");
		result += " No data\n";
		result += separator();
		return result;
	}
	if (lastRowIndex === 2) {
		console.log("Short-circuiting because of 1 item");
		result += "คงเหลือ: " + balance + " บาท\n";
		result += separator();
		return result;
	}

	console.log("Concatenating the summary message...")
	// multiple items are present in the table
	for (let i = 2; i <= lastRowIndex; i++) {
		const date = new Date(GOOGLE_SHEET.getRange(i, 1).getValue());
		// include only today items
		if (differenceInDays(date) < 0) {
			const dateFormatted = Utilities.formatDate(date, 'GMT+7', 'dd/MM');
			const item = GOOGLE_SHEET.getRange(i, 2).getValue();
			const price = GOOGLE_SHEET.getRange(i, 3).getDisplayValue();
			const type = GOOGLE_SHEET.getRange(i, 4).getValue() === 'INCOME' ? "(+)" : "(-)";
			result += " " + dateFormatted + " " + type + " " + item + " : " + price + " บาท\n"
		}
	}

	// summary
	result += separator();
	result += " ทุน:         " + capital + " บาท\n";
	result += " รายได้ทั้งหมด: " + income + " บาท\n";
	result += " รายจ่ายรวม:  " + expenses + " บาท\n";
	result += " คงเหลือสุทธิ:  " + balance + " บาท\n";
	result += separator();
	return result;
}

/**
 * Changes the data in the Google Sheet based on the input and returns a message to be returned to the user.
 *
 * @param userMessage Data
 * @returns {string} User message
 */
function change(userMessage) {
	const today = now();
	const lastRowIndex = getLastRowIndex();

	// split the input by empty characters into array using Regex
	const inputArray = userMessage.split(/\s+/);
	if (inputArray.length < 2) {
		return "🚫 INPUT ERROR\n\n" + "The input cannot be parsed: " + inputArray;
	}
	const item = inputArray[0];
	const price = Number(inputArray[1]);
	const type = price > 0 ? "INCOME" : "EXPENSE";

	GOOGLE_SHEET.getRange(lastRowIndex + 1, 1).setBorder(true, true, true, true, false, false).setValue(today);
	GOOGLE_SHEET.getRange(lastRowIndex + 1, 2).setBorder(true, true, true, true, false, false).setValue(item);
	GOOGLE_SHEET.getRange(lastRowIndex + 1, 3).setBorder(true, true, true, true, false, false).setValue(Math.abs(price));
	GOOGLE_SHEET.getRange(lastRowIndex + 1, 4).setBorder(true, true, true, true, false, false).setValue(type);

	// join the parameters with the empty space delimiter
	const result = [today, item, price, 'บาท (' + type.toLowerCase() + ')'].join(" ");
	return result + "\n✍️บันทึกแล้ว";
}

/**
 * Gets the last row index by the table income/expenses.
 *
 * @returns {number} Last row index
 */
function getLastRowIndex() {
	const rows = GOOGLE_SHEET.getRange('B:B').getValues();
	const index = rows.filter(String).length;
	console.log("The records end at the index", index);
	return index;
}

/**
 * Gets the cell number.
 *
 * @param cell Google Sheet cell
 * @return {number}
 */
function getCellNumber(cell) {
	const number = Number(cell.getValue());
	if (Number.isNaN(number)) {
		console.error("Cannot resolve numeric value from %s (returning 0)", cell.getValue());
		return 0;
	} else {
		console.log("Resolved numeric value", number);
		return number;
	}
}

/**.
 * Returns a difference between today and the given date
 *
 * @param date Date
 */
function differenceInDays(date) {
	const today = new Date(new Date().toISOString().slice(0, 10));
	const diffInMs = today - date;
	const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
	console.log("Calculated difference of %s from %s is %d", today.toISOString(), date.toISOString(), diffInDays);
	return diffInDays;
}

/**
 * Gets a visual separator.
 *
 * @return {string}
 */
function separator() {
	return "====================\n";
}

/**
 * Gets a current date and time in the specific time-zone.
 *
 * @return {Date}
 */
function now() {
	return new Date(new Date().toLocaleString("en-US", {timeZone: TIME_ZONE}));
}

/**
 * Gets a current time zone offset string, for example +05:30 or -07:00
 *
 * @return {string}
 */
function timeZoneOffset(timeZone) {
	const date = new Date().toLocaleString('en', {timeZone, timeZoneName: 'short'}).split(' ');
	const timeZoneName = date[date.length - 1];
	const offset = timeZoneName.slice(3);
	if (!offset) {
		return 0;
	}
	const array = offset.match(/([+-])(\d+)(?::(\d+))?/);
	const pad = (num) => String(num).padStart(2, '0')
	return array[1] + pad(array[2]) + ":" + (array[3] === undefined ? "00" : pad(array[3]));
}