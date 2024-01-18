/**
	Verifies whether the string follows the OID pattern

	@param {String} str - string to verify
	@return {Boolean} return true if string follows the OID pattern
*/
function isOID(str) {
  const oid = /^(\d+\.)+\d+$/;
  return oid.test(String(str));
}