/****************************************************************************
 * lineapp-accounting-chatbot 1.0.0
 * Nikolas Charalambidis 2013 | Forked from https://gist.github.com/iton5/eb11191e7ce340d0a006429a1b4316ca
 ****************************************************************************/


/****************************************************************************
 * INPUT CONSTANTS
 ****************************************************************************/


/**
 * Timezone.
 * @type {Intl.Locale}
 */
const LOCALE = new Intl.Locale("th-TH")

/**
 * Seconds to the past the script checks for duplicated items.
 * @type {number}
 */
const SECONDS_FOR_ITEM_PROTECTION = 180

/**
 * Replace 'xxx' with the Line access token.
 * For example: '+pHoa+pF84EAkH6WgIspLKE5z'
 * Don't forge to wrap it between the single-quotation marks and remember, the link can be much longer than in the example.
 * @type {string}
 */
const ACCESS_TOKEN = 'xxx'

/**
 * Replace 'xxx' with the Google Sheet edit URL.
 * For example: 'https://docs.google.com/spreadsheets/d/2csFUCjBP8/edit'
 * Don't forge to wrap it between the single-quotation marks and remember, the link can be much longer than in the example.
 * @type {string}
 */
const GOOGLE_SHEET_URL = 'xxx'

/**
 * Replace 'xxx' with the Google Sheet individual sheet name.
 * For example: 'sheet1'
 * Don't forge to wrap it between the single-quotation marks and remember, the link can be much longer than in the example.
 * @type {string}
 */
const GOOGLE_SHEET_NAME = 'xxx'


/****************************************************************************
 * CALCULATED CONSTANTS
 ****************************************************************************/


const GOOGLE_SPREADSHEET = SpreadsheetApp.openByUrl(GOOGLE_SHEET_URL)
const GOOGLE_SHEET = GOOGLE_SPREADSHEET.getSheetByName(GOOGLE_SHEET_NAME)
const LINE_API_REPLY = 'https://api.line.me/v2/bot/message/reply'
const TIME_ZONE = LOCALE.timeZones[0]


/****************************************************************************
 * SCRIPT METHODS
 ****************************************************************************/


/**
 * Main method.
 */
function doPost(e) {
	GOOGLE_SPREADSHEET.setSpreadsheetLocale(LOCALE)
	try {
		const data = JSON.parse(e.postData.contents).events[0]
		const userMessage = data.message.text
		console.log("Data: ", userMessage)

		let result
		if (userMessage === "สรุป" || userMessage === "sum" || userMessage === "summary") {
			console.log("Requesting summary...")
			result = summary()
		} else {
			console.log("Adding data...: ", userMessage)
			result = change(userMessage)
		}
		reply(data, result)
	} catch (error) {
		console.log("🚫 SCRIPT ERROR", error)
		reply(data, "🚫 SCRIPT ERROR\n\n" + error)
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
			'Content-Type': 'application/json;charset=UTF-8',
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
	})

	return ContentService
		.createTextOutput(JSON.stringify({'content': 'post ok'}))
		.setMimeType(ContentService.MimeType.JSON)
}

/**
 * Returns summary from the data in the Google Sheet as a message to be returned to the user.
 *
 * @returns {string} User message
 */
function summary() {
	const lastRowIndex = getLastRowIndex()

	const capital = GOOGLE_SHEET.getRange(1, 7).getDisplayValue()
	const income = GOOGLE_SHEET.getRange(2, 7).getDisplayValue()
	const expenses = GOOGLE_SHEET.getRange(3, 7).getDisplayValue()
	const balance = GOOGLE_SHEET.getRange(4, 7).getDisplayValue()

	let result = separator()

	// short-circuiting
	if (lastRowIndex === 1) {
		console.log("Short-circuiting because of 0 items")
		result += " No data\n"
		result += separator()
		return result
	}
	if (lastRowIndex === 2) {
		console.log("Short-circuiting because of 1 item")
		result += "คงเหลือ: " + balance + " บาท\n"
		result += separator()
		return result
	}

	console.log("Concatenating the summary message...")
	// multiple items are present in the table
	for (let i = 2; i <= lastRowIndex; i++) {
		const date = fixTimezone(new Date(GOOGLE_SHEET.getRange(i, 1).getValue()), false)
		const dateString = date.toLocaleString({timeZone: TIME_ZONE}).slice(0,10)
		const todayDateString = new Date().toLocaleString({timeZone: TIME_ZONE}).slice(0,10)
		// include only today items
		if (dateString === todayDateString) {
			const dateFormatted = Utilities.formatDate(date, 'GMT+7', 'dd/MM')
			const item = GOOGLE_SHEET.getRange(i, 2).getValue()
			const price = GOOGLE_SHEET.getRange(i, 3).getValue()
			const type = GOOGLE_SHEET.getRange(i, 4).getValue() === 'INCOME' ? "(+)" : "(-)"
			result += " " + dateFormatted + " " + type + " " + item + " : " + price + " บาท\n"
		}
	}

	// summary
	result += separator()
	result += " ทุน:         " + capital + " บาท\n"
	result += " รายได้ทั้งหมด: " + income + " บาท\n"
	result += " รายจ่ายรวม:  " + expenses + " บาท\n"
	result += " คงเหลือสุทธิ:  " + balance + " บาท\n"
	result += separator()
	return result
}

/**
 * Changes the data in the Google Sheet based on the input and returns a message to be returned to the user.
 *
 * @param userMessage Data
 * @returns {string} User message
 */
function change(userMessage) {
	const today = new Date()
	console.log("Now: " + today)
	const lastRowIndex = getLastRowIndex()

	// split the input by empty characters into array using Regex
	const inputArray = userMessage.split(/\s+/)
	if (inputArray.length < 2) {
		return "🚫 INPUT ERROR\n\n" + "The input cannot be parsed: " + inputArray
	}
	const item = inputArray[0]
	const price = Number(inputArray[1])
	const type = price > 0 ? "INCOME" : "EXPENSE"

	for (var i = lastRowIndex; i > 1; i--) {
		const seconds = secondsFromInsertion(i, today)
		if (seconds < SECONDS_FOR_ITEM_PROTECTION) {
			if (isDuplicate(i, item, price, type)) {
				console.log("Duplicate found at index " + i + " that was inserted less than " + SECONDS_FOR_ITEM_PROTECTION + " seconds ago (" + seconds + "), skipping...")
				return "⚠ INPUT WARNING\n\n" + "Inserting a duplicate entry was prevented: " + inputArray
			} else {
				console.log("Duplicate check passed for index " + i + ", inserted seconds ago (" + seconds + ")")
				// try the next one in the cycle
			}
		} else {
			console.log("Elapsed seconds check passed for index " + i + ", inserted seconds ago (" + seconds + "), inserting...")
			// assuming the items are sorted in the ascending order of insertion, there is no need to check the previous items
			break
		}
	}

	GOOGLE_SHEET.getRange(lastRowIndex + 1, 1).setBorder(true, true, true, true, false, false).setValue(today.toLocaleString('en-UK', { timeZone: TIME_ZONE }))
	GOOGLE_SHEET.getRange(lastRowIndex + 1, 2).setBorder(true, true, true, true, false, false).setValue(item)
	GOOGLE_SHEET.getRange(lastRowIndex + 1, 3).setBorder(true, true, true, true, false, false).setValue(Math.abs(price))
	GOOGLE_SHEET.getRange(lastRowIndex + 1, 4).setBorder(true, true, true, true, false, false).setValue(type)

	// join the parameters with the empty space delimiter
	const result = [today, item, price, 'บาท (' + type.toLowerCase() + ')'].join(" ")
	return result + "\n✍️บันทึกแล้ว"
}

/**
 * Gets a number of seconds that elapsed from the insertion from the item at a given index.
 *
 * @param index Index of the item to be compared
 * @param today Time for comparison
 * @return {number}
 */
function secondsFromInsertion(index, today) {
	const recentTime = fixTimezone(new Date(GOOGLE_SHEET.getRange(index, 1).getValue()), false)
	return (today - recentTime) / 1000
}

/**
 * Checks whether the item at a particular index is duplicate based on the given data.
 *
 * @param index Index of the item to be compared
 * @param item Given item name
 * @param price Given item price
 * @param type Given item type
 * @return {boolean}
 */
function isDuplicate(index, item, price, type) {
	const recentItem = GOOGLE_SHEET.getRange(index, 2).getValue()
	const recentPriceRaw = GOOGLE_SHEET.getRange(index, 3).getValue()
	const recentType = GOOGLE_SHEET.getRange(index, 4).getValue()
	const recentPrice = recentPriceRaw * (recentType === "EXPENSE" ? -1 : 1)

	return recentItem === item && recentPrice === price && recentType === type
}

/**
 * Gets the last row index by the table income/expenses.
 *
 * @returns {number} Last row index
 */
function getLastRowIndex() {
	const rows = GOOGLE_SHEET.getRange('B:B').getValues()
	const index = rows.filter(String).length
	console.log("The records end at the index", index)
	return index
}

/**
 * Gets a visual separator.
 *
 * @return {string}
 */
function separator() {
	return "====================\n"
}

/**
 * Fixes offset/timezone of the input date.
 *
 * @param date Date
 * @param add Flag whether the offset should be added ('true') or subtracted ('false') from the given timezone ('TIME_ZONE').
 * @return {Date}
 */
function fixTimezone(date, add) {
	const zonedDate = new Date(date.toLocaleString('en-US', { timeZone: TIME_ZONE }))
	const diff = Math.abs(date.getTime() - zonedDate.getTime())
	const timestamp = date.getTime() + (add ? diff : -diff)
	const result = new Date(timestamp)
	console.log("Fixed timezone (" + (add ? "add" : "subtract") + "): " + date + " -> " + result)
	return result
}