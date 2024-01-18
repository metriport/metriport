// This script executes once for each deploy, undeploy, or redeploy task
// if at least one channel was undeployed
// You only have access to the globalMap here to persist data

var conn;
if (globalMap.containsKey('CONN')) try {
	
	conn = globalMap.get('CONN');
	conn.close();
	globalMap.remove('CONN');
	
} catch(ex) {} finally {conn = null;}


return;