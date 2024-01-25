/**
	Converts the string to title case string

	@param {String} str - string to convert
	@return {String} return title case string
*/
function getTitleCase(str) {
	if (str) {
		var str = String(str).toLowerCase();
		return str.charAt(0).toUpperCase() + str.slice(1);
	} else 
		return str;
}