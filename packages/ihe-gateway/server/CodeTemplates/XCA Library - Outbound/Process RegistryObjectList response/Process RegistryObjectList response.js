/**
	Processes AdhocQueryResponse RegistryObjectList with ExtrinsicObject or ObjectRef

	@param {Object} list - RegistryObjectList object
	@return {Object} return Content object
*/
function processRegistryObjectList(list) {

	var content = [];

	try {

		if (list.*::ObjectRef.length() > 0) {
			
			for each (var entry in list.*::ObjectRef) {
				var attachment = {};
				attachment.homeCommunityId = entry.@home.toString().replace('urn:oid:', '');
				attachment.urn = entry.@id.toString().replace('urn:uuid:', '');
				content.push(attachment);
			}
			
		} else if (list.*::ExtrinsicObject.length() > 0) {
			
			for each (var entry in list.*::ExtrinsicObject) {

				// Aligned with the FHIR Attachment data type, with additional params for XCA ITI-39
				var attachment = {};

				attachment.contentType = entry.@mimeType.toString();

				var language = entry.*::Slot.("languageCode" == @name).*::ValueList.*::Value.toString();
				if (language) attachment.language = language.toString();
				
				attachment.homeCommunityId = entry.@home.toString().replace('urn:oid:', '');
	
				var repositoryUniqueId = entry.*::Slot.("repositoryUniqueId" == @name).*::ValueList.*::Value.toString();
				if (repositoryUniqueId) attachment.repositoryUniqueId = repositoryUniqueId.toString();

				var docUniqueId = entry.*::ExternalIdentifier.("urn:uuid:2e82c1f6-a085-4c72-9da3-8640a32e42ab" == @identificationScheme).@value.toString();
				if (docUniqueId) attachment.docUniqueId = docUniqueId.toString();

				var size = entry.*::Slot.("size" == @name).*::ValueList.*::Value.toString();
				if (size) try {
					attachment.size = parseInt(size);
				} catch(ex) {}

				var hash = entry.*::Slot.("hash" == @name).*::ValueList.*::Value.toString();
				if (hash) try {
					attachment.hash = parseInt(hash);
				} catch(ex) {}

				var title = entry.*::Classification.("urn:uuid:41a5887f-8865-4c09-adf7-e362475b143a" == @classificationScheme).*::Name.*::LocalizedString.@value.toString();
				if (title) attachment.title = title.toString();
	
				var created = entry.*::Slot.("creationTime" == @name).*::ValueList.*::Value.toString();
				if (created) try {
					var timestampLength = created.length;
					if (timestampLength === 8) {
						attachment.creation = DateUtil.convertDate('yyyyMMdd', "yyyy-MM-dd", created);
					}
					if (timestampLength === 14) {
						attachment.creation = DateUtil.convertDate('yyyyMMddhhmmss', "yyyy-MM-dd'T'hh:mm:ss", created);
					}
				} catch(ex) {}

				var serviced = entry.*::Slot.("serviceStartTime" == @name).*::ValueList.*::Value.toString();
				if (serviced) try {
					var timestampLength = serviced.length;
					if (timestampLength === 8) {
						attachment.creation = DateUtil.convertDate('yyyyMMdd', "yyyy-MM-dd", serviced);
					}
					if (timestampLength === 14) {
						attachment.creation = DateUtil.convertDate('yyyyMMddhhmmss', "yyyy-MM-dd'T'hh:mm:ss", serviced);
					}
				} catch(ex) {}

				var authorInstitution = entry.*::Classification.*::Slot.("authorInstitution" == @name).*::ValueList.*::Value.toString();
				if (authorInstitution) try {
					attachment.authorInstitution = authorInstitution;
				} catch (ex) {}
				
				content.push(attachment);
			}
		}
	
		return (content.length > 0) ? content : null;

	} catch(ex) {
		if (globalMap.containsKey('TEST_MODE')) logger.error('Code Template: processRegistryObjectList() - ' + ex);
		return null;
	}
}