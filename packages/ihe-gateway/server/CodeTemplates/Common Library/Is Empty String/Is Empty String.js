/**
	Verifies whether the string contains no characters

	@param {String} str - string to validate
	@return {Boolean} return true if string is empty
*/
function isNotEmpty(str) {
	try {
		return String(str).trim().length > 0;
	} catch (ex) {
		return false;
	}
}