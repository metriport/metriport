if (parameterList.length() > 0) {	

	channelMap.put('PARAMLIST', parameterList);
	
} else {
	
	// Nothing to process
	destinationSet.removeAll();
	channelMap.put('QACK', 'Error');
	channelMap.put('RESULT', 'NO DOCUMENTS');
	
}