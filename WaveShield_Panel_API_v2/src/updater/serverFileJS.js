function SaveResourceFile(resourceName, fileName, data) {
	const filePath = GetResourcePath(resourceName) + "/" + fileName;

	try {
		fs.writeFileSync(filePath, data);
		return true;
	} catch (err) {
		console.error(`Error saving @${resourceName}/${fileName}:`, err);
		return false;
	}
}

function LoadResourceFile(resourceName, fileName) {
	try {
		const filePath = GetResourcePath(resourceName) + "/" + fileName;
		const data = fs.readFileSync(filePath, "utf8");

		return data;
	} catch (err) {
		console.error(`Error reading @${resourceName}/${fileName}:`, err);
		return null;
	}
}

function CreateDirectory(resourceName, dirName) {
	const dirPath = GetResourcePath(resourceName) + "/" + dirName;

	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

function StopServer() {
	process.exit(0);
}

exports("SaveResourceFile", SaveResourceFile);
exports("LoadResourceFile", LoadResourceFile);
exports("CreateDirectory", CreateDirectory);
exports("StopServer", StopServer);
exports("js_loaded", () => {
	return true;
});
