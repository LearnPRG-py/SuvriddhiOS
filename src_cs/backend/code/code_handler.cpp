#include "code_handler.h"
#include <fstream>
#include <set>

namespace {
bool EndsWith(const std::string &value, const std::string &suffix)
{
	return value.size() >= suffix.size() &&
		value.compare(value.size() - suffix.size(), suffix.size(), suffix) == 0;
}

std::string PythonFilename(const std::string &filename)
{
	std::string name = SanitizeFilename(filename);
	// Accept names entered with an extension, but store and expose only the
	// extension-free program name to the frontend.
	if (EndsWith(name, ".py.c"))
		name.erase(name.size() - 5);
	else if (EndsWith(name, ".py"))
		name.erase(name.size() - 3);
	else if (EndsWith(name, ".c"))
		name.erase(name.size() - 2);
	return name;
}

std::string ProgramPath(const std::string &name)
{
	return std::string(kSaveDir) + "/" + name + ".py";
}
} // namespace

int HandleSave(struct mg_connection *conn, void *)
{
	json req = GetJsonReq(conn);
	std::string filename = req.value("filename", "");
	std::string code = req.value("code", "");
	std::string safe_name = PythonFilename(filename);
	WriteFile(ProgramPath(safe_name), code);

	json res = { { "filename", safe_name } };
	std::string out = res.dump();
	SendResponse(conn, out);
	return 200;
}

int HandleLoad(struct mg_connection *conn, void *)
{
	json req = GetJsonReq(conn);
	std::string filename = req.value("filename", "");
	std::string safe_name = PythonFilename(filename);
	std::ifstream file(ProgramPath(safe_name));
	// Read existing files saved by the earlier C-based sandbox once, so users
	// do not lose their programs after the Python-only switch.
	if (!file.is_open())
		file.open(std::string(kSaveDir) + "/" + safe_name + ".py.c");
	if (!file.is_open())
		file.open(std::string(kSaveDir) + "/" + safe_name + ".c");
	std::string code((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
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
		if (EndsWith(filename, ".py.c"))
			files.insert(filename.substr(0, filename.size() - 5));
		else if (EndsWith(filename, ".py"))
			files.insert(filename.substr(0, filename.size() - 3));
		else if (EndsWith(filename, ".c"))
			files.insert(filename.substr(0, filename.size() - 2));
	}
	for (const auto &filename : files) {
		res["files"].push_back(filename);
	}
	SendResponse(conn, res.dump());
	return 200;
}
