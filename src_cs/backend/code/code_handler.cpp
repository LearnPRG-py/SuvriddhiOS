#include "code_handler.h"
#include <fstream>
#include <set>

namespace
{

// Trims additional .s without hardcoding.
const std::string PythonFilename(const std::string &filename)
{
	std::string name = SanitizeFilename(filename);
	size_t dot_pos = name.rfind('.');
	if (dot_pos != std::string::npos)
		name.erase(dot_pos);
	return name;
}

const std::string ProgramPath(const std::string &name)
{
	return std::string(kSaveDir) + "/" + name + ".py";
}

} // namespace

int HandleSave(struct mg_connection *conn, void *)
{
	json req = GetJsonReq(conn);
	std::string filename = req.value("filename", "");
	std::string code = req.value("code", "");
	const std::string safe_name = PythonFilename(filename);
	WriteFile(ProgramPath(safe_name), code);

	json res = { { "filename", safe_name } };
	const std::string out = res.dump();
	SendResponse(conn, out);
	return 200;
}

int HandleLoad(struct mg_connection *conn, void *)
{
	json req = GetJsonReq(conn);
	std::string filename = req.value("filename", "");
	const std::string safe_name = PythonFilename(filename);
	std::ifstream file(ProgramPath(safe_name));
	const std::string code((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
	file.close();

	json res = { { "code", code } };
	SendResponse(conn, res.dump());
	return 200;
}

int HandleList(struct mg_connection *conn, void *)
{
	json res;
	res["files"] = json::array();
	std::set<std::string> files;
	for (auto &p : std::filesystem::directory_iterator(kSaveDir)) {
		if (!p.is_regular_file())
			continue;

		std::string filename = p.path().filename().string();
		// Since we dont support c yet.
		if (filename.substr(filename.size(), filename.size() - 2) == ".py") {
			files.insert(PythonFilename(filename.substr(0, filename.size() - 2)));
		}
	}
	for (const auto &filename : files) {
		res["files"].push_back(filename);
	}
	SendResponse(conn, res.dump());
	return 200;
}
