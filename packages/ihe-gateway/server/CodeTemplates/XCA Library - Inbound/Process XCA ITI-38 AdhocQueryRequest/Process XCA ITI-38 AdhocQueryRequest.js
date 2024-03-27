/**
	The list of functions for processing XCA ITI-38 request slots

	@return {Object} return the list of functions to process XCA ITI-38 requests
*/
function getAdhocQueryRequestOptionFn() {

	const queryRequestOptionFn = {
		XDSDocumentEntryStatus: function(slot) { return processXDSDocumentEntryArray(slot); },		
		XDSDocumentEntryClassCode: function(slot) { return processXDSDocumentEntryArray(slot); },
		XDSDocumentEntryTypeCode: function(slot) { return processXDSDocumentEntryArray(slot); },
		XDSDocumentEntryPracticeSettingCode: function(slot) { return processXDSDocumentEntryArray(slot); },
		XDSDocumentEntryHealthcareFacilityTypeCode: function(slot) { return processXDSDocumentEntryArray(slot); },
		XDSDocumentEntryEventCodeList: function(slot) { return processXDSDocumentEntryArray(slot); },
		XDSDocumentEntryConfidentialityCode: function(slot) { return processXDSDocumentEntryArray(slot); },
		XDSDocumentEntryFormatCode: function(slot) { return processXDSDocumentEntryArray(slot); },
		
		XDSDocumentEntryCreationTimeFrom: function(slot) { return processXDSDocumentEntryDateTime(slot); },
		XDSDocumentEntryCreationTimeTo: function(slot) { return processXDSDocumentEntryDateTime(slot);	},
		XDSDocumentEntryServiceStartTimeFrom: function(slot) { return processXDSDocumentEntryDateTime(slot); },
		XDSDocumentEntryServiceStartTimeTo: function(slot) { return processXDSDocumentEntryDateTime(slot);	},
		XDSDocumentEntryServiceStopTimeFrom: function(slot) { return processXDSDocumentEntryDateTime(slot);	},
		XDSDocumentEntryServiceStopTimeTo: function(slot) { return processXDSDocumentEntryDateTime(slot); },

		XDSDocumentEntryPatientId: function (slot) {
			var result = {};
			try {
				// First, decode any HTML entities
				var decodedValue = slot.ValueList.Value.toString().replace(/&amp;/g, "&");
				// Then, remove unwanted characters
				var cleanedValue = decodedValue.replace(/['"]/g, "").trim();
				// Split by '^', expecting the format to be id^^^system&000&ISO
				var parts = cleanedValue.split("^");
				var id = parts[0];
				
				var system = parts[3].split("&")[1];
				result.id = id;
				result.system = system;
			}
			catch (ex) {
				return null;
			}
			return result;
		},

		XDSDocumentEntryType: function(slot) { 
			var result = [];
			for each (var value in slot.ValueList.Value) {
				if (value.indexOf('7edca82f-054d-47f2-a032-9b2a5b5186c1') > 0) result.push('Stable');
				else if (value.indexOf('34268e47-fdf5-41a6-ba33-82133c465248') > 0) result.push('On-Demand');
			}
			return (result.length > 0) ? result : null;
		},

		XDSDocumentEntryAuthorPerson: function(slot) {
			var result = [];
			for each (var value in slot.ValueList.Value) {
				var entries = String(value).replace(/[()'']/g, '');
				entries = entries.split(',');
				
				entries.forEach(function(entry) {
					if (entry.indexOf('^') > -1) {
						var [,family,given,,suffix,prefix] = entry.split('^');
						result.push({"family":String(family), "given":String(given), "suffix":String(suffix), "prefix":String(prefix)});
					} else {
						result = result.concat(entry);
					}
				});
			}
			return (result.length > 0) ? result : null;
		}
		
	};

	return queryRequestOptionFn;	
}



/**
	Processes slots with multiple entries
	
	@param {Object} slot - AdhocQuery slot
	@return {Object} return an array with request values
*/
function processXDSDocumentEntryArray(slot) {

	// NOTE: only AND logic is supported
		
	var result = [];
	for each (var value in slot.ValueList.Value) {
		var entries = String(value).replace(/[()'']/g, '');
		entries = entries.split(',');
		
		entries.forEach(function(entry) {
			if (entry.indexOf('^') > 0) {
				var [code,,system] = entry.split('^');
				result.push({"code": code, "system": system});
			} else {
				result = result.concat(entry);
			}
		});
	}
	return (result.length > 0) ? result : null;
}


/**
	Processes slots with date
	
	@param {Object} slot - AdhocQuery slot
	@return {Object} return an array with request values
*/
function processXDSDocumentEntryDateTime(slot) {

	// The format of the value is defined as the following regular expression: YYYY[MM[DD[hh[mm[ss]]]]]
	
	result = null;
	try {
		var date = slot.ValueList.Value.toString();
		result = DateUtil.convertDate('yyyyMMddhhmmss'.substring(0, date.toString().length), "yyyy-MM-dd'T'hh:mm:ss", date.toString());		
	} catch(ex) {}
	return result;
}
